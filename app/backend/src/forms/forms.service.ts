import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DatasetFieldKind,
  DatasetStatus,
  type Dataset,
  FormStatus,
  FormVersionState,
  Prisma,
} from '@prisma/client';

import type {
  AuthenticatedActor,
  JsonValue,
  RelationFilterCondition,
  RelationFilterExpression,
} from '@orz-people-platform/types';
import { checksumJson } from '@orz-people-platform/utils';

import { AuditService } from '../audit/audit.service';
import { DatasetsService } from '../datasets/datasets.service';
import { PrismaService } from '../prisma/prisma.service';
import { FormDefinitionValidatorService } from './form-definition-validator.service';
import type {
  CreateFormInput,
  UpdateFormDraftInput,
} from './form-input';

/** Form 版本定义的内部接口，供 versionData 复用。 */
interface VersionDefinitionInput {
  closesAt?: string;
  closingMessageI18n?: Record<string, string>;
  defaultLocale: string;
  descriptionI18n?: Record<string, string>;
  nameI18n: Record<string, string>;
  opensAt?: string;
  schema: Record<string, unknown>;
  submissionAccess: CreateFormInput['submissionAccess'];
  writeMode: CreateFormInput['writeMode'];
}

/** 设备信息采集的固定定义：采集键 → 系统字段 key 和名称。 */
const captureDefinitions = {
  browser: { key: 'device_browser', name: 'Browser' },
  operatingSystem: { key: 'device_operating_system', name: 'Operating system' },
  userAgent: { key: 'device_user_agent', name: 'User-Agent' },
} as const;

/**
 * Form 管理服务。
 * 负责 Form 的创建、草稿更新、发布、状态变更、公开版本获取和关联选项查询。
 * 权限遵循 Dataset 模型：owner/maintainer 可管理 Form。
 */
@Injectable()
export class FormsService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly datasets: DatasetsService,
    private readonly validator: FormDefinitionValidatorService,
    private readonly audit: AuditService,
  ) {}

  /**
   * 列出当前操作者可见的 Form。
   * 持有 form.manage_all 权限的用户看到全部；
   * 其他用户只看到其可读 Dataset 下的 Form。
   */
  public async list(workspaceId: number, actor: AuthenticatedActor) {
    if (actor.workspaceId !== workspaceId) throw new NotFoundException('Workspace not found');
    if (actor.permissions.includes('form.manage_all')) {
      return this.prisma.form.findMany({
        where: { workspaceId },
        include: { activeVersion: true },
        orderBy: { createdAt: 'desc' },
      });
    }
    const datasets = await this.datasets.list(workspaceId, actor);
    return this.prisma.form.findMany({
      where: { workspaceId, datasetId: { in: datasets.items.map((dataset) => dataset.id) } },
      include: { activeVersion: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 获取单个 Form，含活跃版本和全部历史版本列表。 */
  public async get(workspaceId: number, formId: string, actor: AuthenticatedActor) {
    const form = await this.findForm(workspaceId, formId);
    if (!actor.permissions.includes('form.manage_all')) {
      await this.datasets.assertCanRead(workspaceId, form.datasetId, actor);
    }
    return this.prisma.form.findUniqueOrThrow({
      where: { id: formId },
      include: { activeVersion: true, versions: { orderBy: { version: 'desc' } } },
    });
  }

  /**
   * 创建 Form 及其首个草稿版本。
   * 同时处理设备信息采集字段的自动创建（若 Schema 中启用）。
   */
  public async create(
    workspaceId: number,
    dto: CreateFormInput,
    actor: AuthenticatedActor,
  ) {
    const dataset = await this.findManagedDataset(workspaceId, dto.datasetId, actor);
    if (dataset.status !== DatasetStatus.active) throw new ConflictException('Dataset is archived');
    this.validateMetadata(dto);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const { schema, checksum } = await this.prepareFormSchema(tx, dataset, dto, actor.userId);
        const form = await tx.form.create({
          data: {
            workspaceId,
            datasetId: dataset.id,
            slug: dto.slug,
            createdByUserId: actor.userId,
          },
        });
        const version = await tx.formVersion.create({
          data: {
            formId: form.id,
            version: 1,
            state: FormVersionState.draft,
            ...this.versionData(dto, schema, checksum),
            createdByUserId: actor.userId,
          },
        });
        await this.audit.record({
          action: 'form.create',
          actorType: 'user',
          actorUserId: actor.userId,
          resourceType: 'form',
          resourceId: form.id,
          result: 'success',
          workspaceId,
          metadata: { datasetId: dataset.id, draftVersionId: version.id },
        }, tx);
        return { ...form, versions: [version] };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Form slug is already in use');
      }
      throw error;
    }
  }

  /**
   * 更新 Form 草稿。
   * 若最新版本已是草稿 → 原地更新（CAS 乐观锁）；
   * 若最新版本已发布 → 创建新版本号的新草稿。
   */
  public async updateDraft(
    workspaceId: number,
    formId: string,
    dto: UpdateFormDraftInput,
    actor: AuthenticatedActor,
  ) {
    const form = await this.findForm(workspaceId, formId);
    const dataset = await this.findManagedDataset(workspaceId, form.datasetId, actor);
    if (form.status === FormStatus.archived || dataset.status !== DatasetStatus.active) {
      throw new ConflictException('Form or Dataset is archived');
    }
    this.validateMetadata(dto);
    return this.prisma.$transaction(async (tx) => {
      const { schema, checksum } = await this.prepareFormSchema(tx, dataset, dto, actor.userId);
      const latest = await tx.formVersion.findFirst({
        where: { formId },
        orderBy: { version: 'desc' },
      });
      if (!latest) throw new ConflictException('Form draft is missing');
      let version;
      if (latest.state === FormVersionState.draft) {
        // 原地更新已有草稿。
        const result = await tx.formVersion.updateMany({
          where: { id: latest.id, state: FormVersionState.draft, revision: dto.expectedRevision },
          data: {
            ...this.versionData(dto, schema, checksum),
            revision: { increment: 1 },
          },
        });
        if (result.count !== 1) throw new ConflictException('Form draft revision is stale');
        version = await tx.formVersion.findUniqueOrThrow({ where: { id: latest.id } });
      } else {
        // 基于已发布版本创建新草稿。
        if (latest.revision !== dto.expectedRevision) {
          throw new ConflictException('Form version revision is stale');
        }
        version = await tx.formVersion.create({
          data: {
            formId,
            version: latest.version + 1,
            state: FormVersionState.draft,
            ...this.versionData(dto, schema, checksum),
            createdByUserId: actor.userId,
          },
        });
      }
      await tx.form.update({ where: { id: formId }, data: { revision: { increment: 1 } } });
      await this.audit.record({
        action: 'form.draft.update',
        actorType: 'user',
        actorUserId: actor.userId,
        resourceType: 'form_version',
        resourceId: version.id,
        result: 'success',
        workspaceId,
        metadata: { formId, revision: version.revision },
      }, tx);
      return version;
    });
  }

  /**
   * 发布 Form 草稿。
   * 发布后版本变为不可变 published 状态；原活跃版本被标记为 retired。
   * Form 的 activeVersionId 指针在事务内更新。
   */
  public async publish(
    workspaceId: number,
    formId: string,
    expectedRevision: number,
    actor: AuthenticatedActor,
  ) {
    const form = await this.findForm(workspaceId, formId);
    const dataset = await this.findManagedDataset(workspaceId, form.datasetId, actor);
    if (form.status !== FormStatus.active || dataset.status !== DatasetStatus.active) {
      throw new ConflictException('Form and Dataset must be active');
    }
    return this.prisma.$transaction(async (tx) => {
      const draft = await tx.formVersion.findFirst({
        where: { formId, state: FormVersionState.draft },
        orderBy: { version: 'desc' },
      });
      if (!draft) throw new ConflictException('Form has no draft to publish');
      // 发布前再次校验元数据和 Schema 完整性。
      this.validateMetadata({
        defaultLocale: draft.defaultLocale,
        nameI18n: draft.nameI18n as Record<string, string>,
        descriptionI18n: draft.descriptionI18n as Record<string, string> | undefined,
        closingMessageI18n: draft.closingMessageI18n as Record<string, string> | undefined,
        opensAt: draft.opensAt?.toISOString(),
        closesAt: draft.closesAt?.toISOString(),
      });
      await this.validateDefinition(
        tx,
        dataset,
        draft.schema as Record<string, unknown>,
        draft,
      );
      const result = await tx.formVersion.updateMany({
        where: { id: draft.id, state: FormVersionState.draft, revision: expectedRevision },
        data: {
          state: FormVersionState.published,
          publishedAt: new Date(),
          publishedByUserId: actor.userId,
        },
      });
      if (result.count !== 1) throw new ConflictException('Form draft revision is stale');
      // 将旧活跃版本标记为 retired。
      if (form.activeVersionId) {
        await tx.formVersion.update({
          where: { id: form.activeVersionId },
          data: { state: FormVersionState.retired },
        });
      }
      await tx.form.update({
        where: { id: formId },
        data: { activeVersionId: draft.id, revision: { increment: 1 } },
      });
      await this.audit.record({
        action: 'form.publish',
        actorType: 'user',
        actorUserId: actor.userId,
        resourceType: 'form_version',
        resourceId: draft.id,
        result: 'success',
        workspaceId,
        metadata: { formId, version: draft.version },
      }, tx);
      return tx.formVersion.findUniqueOrThrow({ where: { id: draft.id } });
    });
  }

  /** 变更 Form 状态（active/closed/archived）。已归档 Form 不可再变更。 */
  public async changeStatus(
    workspaceId: number,
    formId: string,
    expectedRevision: number,
    status: FormStatus,
    actor: AuthenticatedActor,
  ) {
    const form = await this.findForm(workspaceId, formId);
    await this.findManagedDataset(workspaceId, form.datasetId, actor);
    if (form.status === FormStatus.archived) throw new ConflictException('Form is archived');
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.form.updateMany({
        where: { id: formId, workspaceId, revision: expectedRevision },
        data: { status, revision: { increment: 1 } },
      });
      if (result.count !== 1) throw new ConflictException('Form revision is stale');
      await this.audit.record({
        action: 'form.status.update',
        actorType: 'user',
        actorUserId: actor.userId,
        resourceType: 'form',
        resourceId: formId,
        result: 'success',
        workspaceId,
        metadata: { status },
      }, tx);
      return tx.form.findUniqueOrThrow({ where: { id: formId } });
    });
  }

  /**
   * 按 slug 获取已发布的 Form 公开版本。
   * 根据请求 locale 选择最佳 i18n 文案；返回结构化读模型而非原始数据库记录。
   */
  public async getPublished(slug: string, locale?: string) {
    const form = await this.findPublishedForm(slug);
    const version = form.activeVersion;
    const selectedLocale = this.selectLocale(
      version.nameI18n as Record<string, string>,
      locale,
      version.defaultLocale,
    );
    return {
      id: form.id,
      slug: form.slug,
      version: version.version,
      locale: selectedLocale,
      name: (version.nameI18n as Record<string, string>)[selectedLocale],
      description: (version.descriptionI18n as Record<string, string> | null)
        ?.[selectedLocale] ?? null,
      closingMessage: (version.closingMessageI18n as Record<string, string> | null)
        ?.[selectedLocale] ?? null,
      opensAt: version.opensAt,
      closesAt: version.closesAt,
      submissionAccess: version.submissionAccess,
      writeMode: version.writeMode,
      schema: version.schema,
    };
  }

  /**
   * 为已发布 Form 的关联选择器提供动态选项。
   * 根据 Schema 中配置的 filter 表达式筛选目标 Dataset 行，
   * 并仅返回 row ID 和 label 字段值。
   */
  public async relationOptions(
    slug: string,
    itemId: string,
    rawValues: string | undefined,
    take: number,
  ) {
    const form = await this.findPublishedForm(slug);
    const schema = form.activeVersion.schema as Record<string, unknown>;
    const property = (schema.properties as Record<string, Record<string, unknown>>)?.[itemId];
    if (!property) throw new NotFoundException('Form item not found');
    const extension = property['x-form'] as Record<string, unknown>;
    const ui = extension.ui as Record<string, unknown> | undefined;
    const options = ui?.options as Record<string, unknown> | undefined;
    const field = await this.prisma.datasetField.findUnique({
      where: { id: extension.datasetFieldId as string },
    });
    if (!field || field.kind !== DatasetFieldKind.relation || !field.relationTargetDatasetId) {
      throw new BadRequestException('Form item is not a relation selector');
    }
    const values = this.parseCurrentValues(rawValues);
    // 查询目标 Dataset 的活跃行（上限 500，内存过滤后再截断至 take）。
    const rows = await this.prisma.datasetRow.findMany({
      where: { datasetId: field.relationTargetDatasetId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    const filter = options?.filter as RelationFilterExpression | undefined;
    const labelFieldId = options?.labelFieldId as string;
    return rows
      .filter((row) => this.matchesFilter(
        row.values as Record<string, JsonValue>,
        filter,
        values,
      ))
      .slice(0, take)
      .map((row) => ({
        id: row.id,
        label: (row.values as Record<string, JsonValue>)[labelFieldId],
      }));
  }

  /**
   * 执行完整的 Form 定义校验。
   * 收集当前 Dataset 字段、关系目标字段和目标 Dataset 后委托给 FormDefinitionValidator。
   */
  private async validateDefinition(
    tx: Prisma.TransactionClient,
    dataset: Pick<Dataset, 'id' | 'subjectMode' | 'type'>,
    schema: Record<string, unknown>,
    definition: Pick<VersionDefinitionInput, 'submissionAccess' | 'writeMode'>,
  ): Promise<void> {
    const sourceFields = await tx.datasetField.findMany({ where: { datasetId: dataset.id } });
    const targetIds = sourceFields.flatMap((field) => (
      field.relationTargetDatasetId ? [field.relationTargetDatasetId] : []
    ));
    const [targetFields, targetDatasets] = await Promise.all([
      targetIds.length === 0 ? [] : tx.datasetField.findMany({
        where: { datasetId: { in: targetIds } },
      }),
      targetIds.length === 0 ? [] : tx.dataset.findMany({
        where: { id: { in: targetIds } },
        select: { id: true, type: true },
      }),
    ]);
    this.validator.validate(schema, {
      dataset,
      fields: [...sourceFields, ...targetFields],
      targetDatasets,
      submissionAccess: definition.submissionAccess,
      writeMode: definition.writeMode,
    });
  }

  /**
   * 确保设备信息采集所需的系统字段存在。
   * 若 capture 中指定了 browser/operatingSystem/userAgent 采集，
   * 按 systemKey 查找并复用已有字段；不存在则自动创建 isSystemManaged=true 的 text 字段。
   * 新创建字段时会创建 DatasetVersion 快照。
   */
  private async ensureCaptureFields(
    tx: Prisma.TransactionClient,
    datasetId: string,
    schema: Record<string, unknown>,
    actorUserId: string,
  ): Promise<void> {
    const root = schema['x-form'] as Record<string, unknown> | undefined;
    const capture = root?.capture as Record<string, { datasetFieldId: string }> | undefined;
    if (!capture || Object.keys(capture).length === 0) return;
    let created = false;
    const position = await tx.datasetField.count({ where: { datasetId, archivedAt: null } });
    await Promise.all(Object.entries(capture).map(async ([captureKey, setting], index) => {
      const definition = captureDefinitions[captureKey as keyof typeof captureDefinitions];
      if (!definition) throw new BadRequestException(`Unknown capture setting: ${captureKey}`);
      // 若已显式选择了一个匹配的系统字段，跳过创建。
      const selected = setting.datasetFieldId && setting.datasetFieldId !== 'managed'
        ? await tx.datasetField.findUnique({ where: { id: setting.datasetFieldId } })
        : null;
      if (selected && selected.datasetId === datasetId
        && selected.isSystemManaged && selected.systemKey === definition.key) return;
      // 按 systemKey 查找已有字段。
      let field = await tx.datasetField.findFirst({
        where: { datasetId, systemKey: definition.key },
      });
      if (!field) {
        field = await tx.datasetField.upsert({
          where: { datasetId_systemKey: { datasetId, systemKey: definition.key } },
          update: {},
          create: {
            workspaceId: 1,
            datasetId,
            key: definition.key,
            name: definition.name,
            kind: DatasetFieldKind.text,
            valueSchema: { type: 'string', maxLength: 2_000 },
            isSystemManaged: true,
            systemKey: definition.key,
            position: position + index,
          },
        });
        created = true;
      }
      // 将 Schema 中的 datasetFieldId 替换为实际字段 ID。
      capture[captureKey] = { datasetFieldId: field.id };
    }));
    if (created) {
      await tx.dataset.update({ where: { id: datasetId }, data: { revision: { increment: 1 } } });
      await this.datasets.createDefinitionVersion(
        tx,
        datasetId,
        actorUserId,
        'form.capture.enable',
      );
    }
  }

  /** 将版本定义转换为 FormVersion 的 Prisma 写入数据。 */
  private versionData(
    dto: VersionDefinitionInput,
    schema: Record<string, unknown>,
    schemaChecksum: string,
  ) {
    return {
      defaultLocale: dto.defaultLocale,
      nameI18n: dto.nameI18n,
      descriptionI18n: dto.descriptionI18n,
      closingMessageI18n: dto.closingMessageI18n,
      opensAt: dto.opensAt ? new Date(dto.opensAt) : undefined,
      closesAt: dto.closesAt ? new Date(dto.closesAt) : undefined,
      submissionAccess: dto.submissionAccess,
      writeMode: dto.writeMode,
      schema: schema as Prisma.InputJsonObject,
      schemaChecksum,
    };
  }

  /**
   * 校验 Form 元数据：
   * - 所有 i18n map 必须包含 defaultLocale 对应的条目
   * - opensAt 必须早于 closesAt
   */
  private validateMetadata(definition: {
    closesAt?: string;
    closingMessageI18n?: Record<string, string>;
    defaultLocale: string;
    descriptionI18n?: Record<string, string>;
    nameI18n: Record<string, string>;
    opensAt?: string;
  }): void {
    [definition.nameI18n, definition.descriptionI18n, definition.closingMessageI18n]
      .filter((map): map is Record<string, string> => Boolean(map))
      .forEach((map) => {
        if (typeof map[definition.defaultLocale] !== 'string') {
          throw new BadRequestException(`Locale map requires ${definition.defaultLocale}`);
        }
      });
    if (definition.opensAt && definition.closesAt
      && new Date(definition.opensAt) >= new Date(definition.closesAt)) {
      throw new BadRequestException('Form opensAt must be before closesAt');
    }
  }

  /** 按 ID 查找 Form，验证其属于指定 Workspace。 */
  private async findForm(workspaceId: number, formId: string) {
    const form = await this.prisma.form.findUnique({ where: { id: formId } });
    if (!form || form.workspaceId !== workspaceId) throw new NotFoundException('Form not found');
    return form;
  }

  /**
   * 查找 Form 所绑定的 Dataset，并验证操作者有管理权限。
   * 持有 form.manage_all 权限的用户绕过协作者校验。
   */
  private async findManagedDataset(
    workspaceId: number,
    datasetId: string,
    actor: AuthenticatedActor,
  ) {
    if (!actor.permissions.includes('form.manage_all')) {
      return this.datasets.assertCanManage(workspaceId, datasetId, actor);
    }
    if (actor.workspaceId !== workspaceId) throw new NotFoundException('Workspace not found');
    const dataset = await this.prisma.dataset.findUnique({
      where: { workspaceId_id: { workspaceId, id: datasetId } },
    });
    if (!dataset) throw new NotFoundException('Dataset not found');
    return dataset;
  }

  /** 根据请求的 locale 和默认语言选择最佳 i18n 文案语言。 */
  private selectLocale(
    map: Record<string, string>,
    requested: string | undefined,
    fallback: string,
  ): string {
    return requested && Object.hasOwn(map, requested) ? requested : fallback;
  }

  /** 将 URL 参数中的 JSON 字符串解析为当前表单值对象，供关联筛选使用。 */
  private parseCurrentValues(raw: string | undefined): Record<string, JsonValue> {
    if (!raw) return {};
    try {
      const value = JSON.parse(raw) as unknown;
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
      return value as Record<string, JsonValue>;
    } catch {
      throw new BadRequestException('Relation option values must be a JSON object');
    }
  }

  /**
   * 根据 filter 表达式筛选行。
   * filter.all → 所有条件均满足；filter.any → 任一条件满足。
   */
  private matchesFilter(
    row: Record<string, JsonValue>,
    filter: RelationFilterExpression | undefined,
    formValues: Record<string, JsonValue>,
  ): boolean {
    if (!filter) return true;
    const conditions = filter.all ?? filter.any ?? [];
    const results = conditions.map(
      (condition) => this.matchesCondition(row, condition, formValues),
    );
    return filter.all ? results.every(Boolean) : results.some(Boolean);
  }

  /**
   * 判断单个筛选条件是否成立。
   * 支持 equals、not_equals、in、contains、is_empty、is_not_empty。
   * valueFrom 引用当前 Form 其他 item 的值，实现级联筛选。
   */
  private matchesCondition(
    row: Record<string, JsonValue>,
    condition: RelationFilterCondition,
    formValues: Record<string, JsonValue>,
  ): boolean {
    const actual = row[condition.fieldId];
    const expected = condition.valueFrom ? formValues[condition.valueFrom] : condition.value;
    if (condition.operator === 'is_empty') return actual === undefined || actual === null || actual === '';
    if (condition.operator === 'is_not_empty') return actual !== undefined && actual !== null && actual !== '';
    if (actual === undefined || expected === undefined) return false;
    if (condition.operator === 'equals') return Object.is(actual, expected);
    if (condition.operator === 'not_equals') return !Object.is(actual, expected);
    if (condition.operator === 'in') return Array.isArray(expected) && expected.includes(actual);
    if (condition.operator === 'contains') {
      return (typeof actual === 'string' && typeof expected === 'string' && actual.includes(expected))
        || (Array.isArray(actual) && actual.includes(expected));
    }
    return false;
  }

  /**
   * 在事务中准备 Form Schema：深拷贝、处理设备信息采集字段、校验定义、计算校验和。
   */
  private async prepareFormSchema(
    tx: Prisma.TransactionClient,
    dataset: Pick<Dataset, 'id' | 'subjectMode' | 'type'>,
    dto: Pick<VersionDefinitionInput, 'schema' | 'defaultLocale' | 'nameI18n' | 'submissionAccess' | 'writeMode'>,
    userId: string,
  ): Promise<{ schema: Record<string, unknown>; checksum: string }> {
    const schema = structuredClone(dto.schema);
    await this.ensureCaptureFields(tx, dataset.id, schema, userId);
    await this.validateDefinition(tx, dataset, schema, dto);
    const checksum = await checksumJson(schema as JsonValue);
    return { schema, checksum };
  }

  /**
   * 查找已发布的 Form（含 activeVersion），未找到或状态异常时抛出 NotFoundException。
   * 返回类型已确保 activeVersion 非 null。
   */
  private async findPublishedForm(slug: string) {
    const form = await this.prisma.form.findUnique({
      where: { workspaceId_slug: { workspaceId: 1, slug } },
      include: { activeVersion: true },
    });
    if (!form || form.status !== FormStatus.active || !form.activeVersion) {
      throw new NotFoundException('Published Form not found');
    }
    // 经过上述校验后 activeVersion 必然非 null，显式断言使调用方无需重复检查。
    return form as typeof form & { activeVersion: NonNullable<typeof form.activeVersion> };
  }
}
