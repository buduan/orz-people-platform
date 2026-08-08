import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ActivityStatus,
  DatasetFieldKind,
  DatasetRowVersionOperation,
  DatasetStatus,
  DatasetType,
  FormStatus,
  FormSubmissionAccess,
  FormSubmissionOperation,
  FormVersionState,
  FormWriteMode,
  JoinRequestStatus,
  Prisma,
} from '@prisma/client';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

import type {
  AuthenticatedActor,
  FormSubmissionContext,
  JsonSchema,
  JsonValue,
  SubmitFormResult,
} from '@weave/types';
import {
  checksumJson,
  findUnavailableSubmittedItemIds,
  getItemExtension,
  getSchemaProperties,
} from '@weave/utils';

import { AuditService } from '../audit/audit.service';
import { RelationValidationService } from '../common/relation-validation.service';
import { createRowVersion } from '../common/row-version.factory';
import { DatasetSchemaService } from '../datasets/dataset-schema.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivitiesService } from '../special-datasets/activities.service';
import type { SubmitFormInput } from './form-submission-input';
import { FormSubmissionRateLimitService } from './form-submission-rate-limit.service';

/** 请求元数据，用于设备信息采集。 */
interface RequestMetadata {
  networkIdentity?: string;
  userAgent?: string;
}

/** 单次写入操作的结果标识。 */
interface WriteResult {
  operation: FormSubmissionOperation;
  rowId: string;
  rowVersionId: string;
}

/** 包含关联 Dataset 的 Form 类型。 */
type SubmissionForm = Prisma.FormGetPayload<{
  include: { activeVersion: true; dataset: true };
}>;

/**
 * Form 提交服务。
 *
 * 核心流程：
 * 1. 加载活跃 FormVersion 和 Dataset
 * 2. 校验开放窗口、身份策略和特殊 Dataset 不变量
 * 3. 使用 AJV Draft 2020-12 校验答案
 * 4. 将 Form item ID 映射为 Dataset field ID（normalizeAnswers）
 * 5. 根据 writeMode 创建行或更新主体行
 * 6. 在同一事务中写入行、关联、行版本、FormSubmission 和 AuditLog
 *
 * 幂等性：同一 formId + idempotencyKey 的相同 payload 返回原结果；
 * 不同 payload 返回 409。
 */
@Injectable()
export class FormSubmissionsService {
  private readonly ajv: Ajv2020;

  public constructor(
    private readonly prisma: PrismaService,
    private readonly schemas: DatasetSchemaService,
    private readonly activities: ActivitiesService,
    private readonly audit: AuditService,
    private readonly relationValidation: RelationValidationService,
    private readonly rateLimit: FormSubmissionRateLimitService,
  ) {
    // useDefaults: true —— AJV 会在校验前自动填入 Schema 中声明的 default 值。
    this.ajv = new Ajv2020({
      allErrors: true,
      strict: true,
      strictRequired: false,
      useDefaults: true,
    });
    addFormats(this.ajv);
    // 注册 x-form 关键字使 AJV 不会因未知关键字报错。
    this.ajv.addKeyword({ keyword: 'x-form', schemaType: 'object', valid: true });
  }

  /** 通过 Form slug 提交（公开入口，支持匿名）。 */
  public async submitBySlug(
    slug: string,
    dto: SubmitFormInput,
    idempotencyKey: string | undefined,
    actor: AuthenticatedActor | null,
    request: RequestMetadata,
  ) {
    const form = await this.prisma.form.findUnique({
      where: { workspaceId_slug: { workspaceId: 1, slug } },
      include: { activeVersion: true, dataset: true },
    });
    if (!form) throw new NotFoundException('Form not found');
    return this.submit(form, dto, idempotencyKey, actor, request);
  }

  /** 通过 Form ID 提交（内部入口，要求已认证）。 */
  public async submitById(
    workspaceId: number,
    formId: string,
    dto: SubmitFormInput,
    idempotencyKey: string | undefined,
    actor: AuthenticatedActor,
    request: RequestMetadata,
  ) {
    if (workspaceId !== actor.workspaceId) throw new UnauthorizedException('Workspace access denied');
    const form = await this.prisma.form.findUnique({
      where: { workspaceId_id: { workspaceId, id: formId } },
      include: { activeVersion: true, dataset: true },
    });
    if (!form) throw new NotFoundException('Form not found');
    return this.submit(form, dto, idempotencyKey, actor, request);
  }

  /** Public Form-ID submission entry, supporting an anonymous or authenticated actor. */
  public async submitByPublicId(
    formId: string,
    dto: SubmitFormInput,
    idempotencyKey: string | undefined,
    actor: AuthenticatedActor | null,
    request: RequestMetadata,
  ): Promise<SubmitFormResult> {
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
      include: { activeVersion: true, dataset: true },
    });
    if (!form
      || form.status === FormStatus.archived
      || !form.activeVersion
      || form.activeVersion.state !== FormVersionState.published) {
      throw new NotFoundException('Published Form not found');
    }
    const result = await this.submit(
      form,
      dto,
      idempotencyKey,
      actor,
      request,
      actor ? `user:${actor.userId}` : `network:${request.networkIdentity ?? 'unknown'}`,
    );
    return {
      submissionId: result.id,
      operation: result.operation,
      submittedAt: result.submittedAt.toISOString(),
    };
  }

  /** Load the authenticated actor's current answers for an update-subject Form. */
  public async getSubjectContext(
    formId: string,
    actor: AuthenticatedActor,
  ): Promise<FormSubmissionContext | null> {
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
      include: { activeVersion: true },
    });
    if (!form
      || form.status === FormStatus.archived
      || !form.activeVersion
      || form.activeVersion.state !== FormVersionState.published
      || form.activeVersion.writeMode !== FormWriteMode.update_subject_row) return null;
    const subject = await this.prisma.datasetRowSubject.findUnique({
      where: { datasetId_userId: { datasetId: form.datasetId, userId: actor.userId } },
      include: { row: { include: { sourceRelations: true } } },
    });
    if (!subject || subject.row.deletedAt) return null;

    const properties = getSchemaProperties(form.activeVersion.schema as JsonSchema);
    if (!properties) return null;
    const mappedFields = Object.values(properties).flatMap((property) => {
      const extension = getItemExtension(property);
      return extension ? [extension.datasetFieldId] : [];
    });
    const fields = await this.prisma.datasetField.findMany({
      where: { id: { in: mappedFields }, datasetId: form.datasetId },
      select: { id: true, kind: true, relationCardinality: true },
    });
    const fieldsById = new Map(fields.map((field) => [field.id, field]));
    const relations = new Map<string, string[]>();
    [...subject.row.sourceRelations]
      .sort((left, right) => left.position - right.position)
      .forEach((relation) => relations.set(relation.fieldId, [
        ...(relations.get(relation.fieldId) ?? []),
        relation.targetRowId,
      ]));
    const rowValues = subject.row.values as Record<string, JsonValue>;
    const answers: Record<string, JsonValue> = {};
    Object.entries(properties).forEach(([itemId, property]) => {
      const extension = getItemExtension(property);
      if (!extension) return;
      const field = fieldsById.get(extension.datasetFieldId);
      if (!field) return;
      if (field.kind === DatasetFieldKind.relation) {
        const targets = relations.get(field.id) ?? [];
        const [target] = targets;
        if (field.relationCardinality === 'many') answers[itemId] = targets;
        else if (target) answers[itemId] = target;
        return;
      }
      const value = rowValues[field.id];
      if (value !== undefined) answers[itemId] = value;
    });
    return { answers, expectedRevision: subject.row.revision };
  }

  /**
   * 统一的提交入口。
   * 处理幂等、窗口校验、JSON Schema 验证、答案规范化、设备采集、
   * 以及 writeMode 分支（createRow / updateSubjectRow）。
   */
  private async submit(
    form: SubmissionForm,
    dto: SubmitFormInput,
    idempotencyKey: string | undefined,
    actor: AuthenticatedActor | null,
    request: RequestMetadata,
    rateLimitIdentity?: string,
  ) {
    if (idempotencyKey && idempotencyKey.length > 128) {
      throw new BadRequestException('Idempotency-Key exceeds 128 characters');
    }
    // 计算 payload 的规范化 checksum，用于幂等校验。
    const payloadChecksum = await checksumJson({
      answers: dto.answers as JsonValue,
      expectedRevision: dto.expectedRevision ?? null,
    });

    // ---- 幂等检查（事务外） ----
    const existing = await this.checkIdempotent(
      this.prisma,
      form.id,
      idempotencyKey,
      payloadChecksum,
    );
    if (existing) return existing;
    if (rateLimitIdentity) await this.rateLimit.consume(form.id, rateLimitIdentity);

    const version = form.activeVersion;
    if (!version || form.status !== FormStatus.active
      || form.dataset.status !== DatasetStatus.active) {
      throw new ConflictException('Form, published version and Dataset must be active');
    }
    // 校验开放/关闭时间窗口。
    this.assertWindow(version.opensAt, version.closesAt);

    // ---- 身份校验 ----
    if (version.submissionAccess === FormSubmissionAccess.authentication_required && !actor) {
      throw new UnauthorizedException('This Form requires authentication');
    }

    // 活动报名 Dataset 额外校验 Activity 状态。
    const activity = form.dataset.type === DatasetType.activity_registrations
      ? await this.prisma.activity.findUnique({
        where: { registrationDatasetId: form.datasetId },
      })
      : null;
    if (form.dataset.type === DatasetType.activity_registrations
      && (!activity || activity.status !== ActivityStatus.open)) {
      throw new ConflictException('Activity is not open for registration');
    }

    // ---- JSON Schema 验证 ----
    const hiddenItemIds = findUnavailableSubmittedItemIds(
      version.schema as JsonSchema,
      dto.answers as Record<string, JsonValue | undefined>,
    );
    if (hiddenItemIds.length > 0) {
      throw new BadRequestException({
        message: 'Form answers contain unavailable items',
        itemIds: hiddenItemIds,
      });
    }
    const answers = structuredClone(dto.answers);
    const validate = this.ajv.compile(version.schema as object);
    if (!validate(answers)) {
      throw new BadRequestException({
        message: 'Form answers are invalid',
        errors: validate.errors,
      });
    }

    // ---- 答案规范化：Form item ID → Dataset field ID ----
    const fields = await this.prisma.datasetField.findMany({
      where: { datasetId: form.datasetId },
    });
    const normalized = this.normalizeAnswers(
      version.schema as Record<string, unknown>,
      fields,
      answers,
    );

    // Join Request 自动写入申请人姓名和邮箱（从账号获取，忽略客户端值）。
    const baseValues = form.dataset.type === DatasetType.join_requests
      ? await this.joinIdentityValues(form.workspaceId, actor, fields)
      : {};

    const validated = this.schemas.validateRow(
      fields,
      normalized,
      {},
      version.writeMode === FormWriteMode.update_subject_row,
    );
    await this.relationValidation.validate(form.workspaceId, fields, validated.relations);

    // 设备信息采集（从 HTTP User-Agent 解析）。
    const capturedValues = this.captureValues(
      version.schema as Record<string, unknown>,
      request.userAgent,
    );

    // 合并系统字段、用户提交值、采集值（后写入的覆盖前者）。
    const values = {
      ...baseValues,
      ...validated.values,
      ...capturedValues,
    } as Prisma.InputJsonObject;

    try {
      // Serializable 隔离级别防止并发幂等写入冲突。
      return await this.prisma.$transaction(async (tx) => {
        // ---- 事务内二次幂等检查 ----
        const concurrent = await this.checkIdempotent(tx, form.id, idempotencyKey, payloadChecksum);
        if (concurrent) return concurrent;

        // ---- 按 writeMode 分支执行写入 ----
        const write = version.writeMode === FormWriteMode.update_subject_row
          ? await this.updateSubjectRow(
            tx,
            form,
            values,
            validated.relations,
            dto,
            actor!,
          )
          : await this.createRow(
            tx,
            form,
            fields,
            values,
            validated.relations,
            actor,
            activity,
          );

        // ---- 创建 FormSubmission 记录 ----
        const submission = await tx.formSubmission.create({
          data: {
            workspaceId: form.workspaceId,
            formId: form.id,
            formVersionId: version.id,
            datasetId: form.datasetId,
            rowId: write.rowId,
            rowVersionId: write.rowVersionId,
            submitterUserId: actor?.userId,
            operation: write.operation,
            idempotencyKey,
            // 仅当请求携带幂等 key 时才存储 checksum。
            payloadChecksum: idempotencyKey ? payloadChecksum : undefined,
          },
        });
        await this.audit.record({
          action: 'form.submit',
          actorType: actor ? 'user' : 'system',
          actorUserId: actor?.userId,
          resourceType: 'form_submission',
          resourceId: submission.id,
          result: 'success',
          workspaceId: form.workspaceId,
          metadata: {
            formId: form.id,
            formVersionId: version.id,
            operation: write.operation,
          },
        }, tx);
        return this.submissionResult(submission);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      // P2002 / P2034 = 并发写入冲突；在事务外再次尝试幂等匹配。
      if (error instanceof Prisma.PrismaClientKnownRequestError
        && (error.code === 'P2002' || error.code === 'P2034')) {
        const retryExisting = await this.checkIdempotent(
          this.prisma,
          form.id,
          idempotencyKey,
          payloadChecksum,
        );
        if (retryExisting) return retryExisting;
        throw new ConflictException('Submission changed concurrently');
      }
      throw error;
    }
  }

  /**
   * createRow 写入路径。
   * 处理标准新增、Join Request 提交/重提、活动报名绑定、subject 绑定。
   */
  private async createRow(
    tx: Prisma.TransactionClient,
    form: SubmissionForm,
    fields: Array<{ id: string; relationTargetDatasetId: string | null }>,
    values: Prisma.InputJsonObject,
    relations: Map<string, string[]>,
    actor: AuthenticatedActor | null,
    activity: {
      id: string;
      registrationDatasetId: string;
      status: ActivityStatus;
      workspaceId: number;
    } | null,
  ): Promise<WriteResult> {
    // Join Request：检查是否已有该用户的申请行（每人每表一行）。
    let existingSubject: Awaited<ReturnType<typeof tx.datasetRowSubject.findUnique>> = null;
    if (form.dataset.type === DatasetType.join_requests) {
      existingSubject = await tx.datasetRowSubject.findUnique({
        where: { datasetId_userId: { datasetId: form.datasetId, userId: actor!.userId } },
      });
    }
    // 已有行 → 重新提交（仅限 rejected/withdrawn 状态）。
    if (existingSubject) {
      return this.resubmitJoinRequest(tx, form, existingSubject.rowId, values, relations, actor!);
    }

    // ---- 创建新行 ----
    const row = await tx.datasetRow.create({
      data: {
        workspaceId: form.workspaceId,
        datasetId: form.datasetId,
        values,
        createdByUserId: actor?.userId,
        updatedByUserId: actor?.userId,
      },
    });
    await this.writeRelations(tx, form.workspaceId, form.datasetId, row.id, fields, relations);

    // Join Request：创建 DatasetRowSubject + JoinRequest 记录。
    if (form.dataset.type === DatasetType.join_requests) {
      await Promise.all([
        tx.datasetRowSubject.create({
          data: {
            workspaceId: form.workspaceId,
            datasetId: form.datasetId,
            rowId: row.id,
            userId: actor!.userId,
          },
        }),
        tx.joinRequest.create({
          data: {
            workspaceId: form.workspaceId,
            datasetId: form.datasetId,
            rowId: row.id,
            status: JoinRequestStatus.submitted,
            submittedAt: new Date(),
          },
        }),
      ]);
    } else if (form.dataset.subjectMode === 'single_per_user') {
      // 其他 single_per_user Dataset：创建用户-行绑定。
      if (!actor) throw new UnauthorizedException('Subject-bound Dataset requires authentication');
      await tx.datasetRowSubject.create({
        data: {
          workspaceId: form.workspaceId,
          datasetId: form.datasetId,
          rowId: row.id,
          userId: actor.userId,
        },
      });
    }

    // 活动报名：创建 ActivityRegistration 绑定。
    if (activity) {
      await this.activities.bindRegistration(tx, activity, row.id, actor?.userId ?? null);
    }

    // 创建行版本快照。
    const rowVersion = await createRowVersion({
      tx,
      rowId: row.id,
      version: row.revision,
      operation: DatasetRowVersionOperation.create,
      values,
      relations,
      actorUserId: actor?.userId,
    });
    return {
      operation: FormSubmissionOperation.created,
      rowId: row.id,
      rowVersionId: rowVersion.id,
    };
  }

  /**
   * Join Request 重提。
   * 仅允许 rejected 或 withdrawn 的申请重新提交；
   * 复用已有行和 JoinRequest 记录，创建新的 RowVersion 保留历史。
   */
  private async resubmitJoinRequest(
    tx: Prisma.TransactionClient,
    form: SubmissionForm,
    rowId: string,
    values: Prisma.InputJsonObject,
    relations: Map<string, string[]>,
    actor: AuthenticatedActor,
  ): Promise<WriteResult> {
    const request = await tx.joinRequest.findUnique({ where: { rowId } });
    if (!request || (request.status !== JoinRequestStatus.rejected
      && request.status !== JoinRequestStatus.withdrawn)) {
      throw new ConflictException('A current Join Request already exists');
    }
    // 更新行数据并清除软删除标记。
    const row = await tx.datasetRow.update({
      where: { id: rowId },
      data: {
        values,
        deletedAt: null,
        revision: { increment: 1 },
        updatedByUserId: actor.userId,
      },
    });
    // 清除旧关联并写入新关联。
    await tx.datasetRelation.deleteMany({ where: { sourceRowId: rowId } });
    const fields = await tx.datasetField.findMany({ where: { datasetId: form.datasetId } });
    await this.writeRelations(tx, form.workspaceId, form.datasetId, rowId, fields, relations);
    // 重置 JoinRequest 为 submitted 状态。
    await tx.joinRequest.update({
      where: { rowId },
      data: {
        status: JoinRequestStatus.submitted,
        submittedAt: new Date(),
        decidedAt: null,
        decidedByUserId: null,
        approvedMemberTypeId: null,
        decisionNote: null,
        revision: { increment: 1 },
      },
    });
    const rowVersion = await createRowVersion({
      tx,
      rowId,
      version: row.revision,
      operation: DatasetRowVersionOperation.update,
      values,
      relations,
      actorUserId: actor.userId,
    });
    return {
      operation: FormSubmissionOperation.updated,
      rowId,
      rowVersionId: rowVersion.id,
    };
  }

  /**
   * updateSubjectRow 写入路径。
   * 通过 DatasetRowSubject 定位当前用户的唯一行（不信任客户端传入的 rowId）。
   * 仅更新映射字段；未传字段保持原值。要求 expectedRowRevision 做乐观锁。
   */
  private async updateSubjectRow(
    tx: Prisma.TransactionClient,
    form: SubmissionForm,
    submittedValues: Prisma.InputJsonObject,
    submittedRelations: Map<string, string[]>,
    dto: SubmitFormInput,
    actor: AuthenticatedActor,
  ): Promise<WriteResult> {
    if (!dto.expectedRevision) {
      throw new BadRequestException('Subject-row update requires expectedRevision');
    }
    // 通过 DatasetRowSubject 定位目标行 —— 不按姓名、邮箱或客户端 rowId 猜测。
    const subject = await tx.datasetRowSubject.findUnique({
      where: { datasetId_userId: { datasetId: form.datasetId, userId: actor.userId } },
      include: { row: { include: { sourceRelations: true } } },
    });
    if (!subject) throw new NotFoundException('Current User has no subject row in this Dataset');

    // 以现有值为基础，仅覆盖提交的字段。
    const values = {
      ...(subject.row.values as Prisma.JsonObject),
      ...submittedValues,
    } as Prisma.InputJsonObject;
    const relations = this.mergeRelations(subject.row.sourceRelations, submittedRelations);

    // CAS 更新。
    const result = await tx.datasetRow.updateMany({
      where: {
        id: subject.rowId,
        revision: dto.expectedRevision,
        deletedAt: null,
      },
      data: { values, revision: { increment: 1 }, updatedByUserId: actor.userId },
    });
    if (result.count !== 1) throw new ConflictException('Dataset row revision is stale');

    // 仅更新提交的关联字段。
    if (submittedRelations.size > 0) {
      await tx.datasetRelation.deleteMany({
        where: { sourceRowId: subject.rowId, fieldId: { in: [...submittedRelations.keys()] } },
      });
      const fields = await tx.datasetField.findMany({ where: { datasetId: form.datasetId } });
      await this.writeRelations(
        tx,
        form.workspaceId,
        form.datasetId,
        subject.rowId,
        fields,
        submittedRelations,
      );
    }
    const row = await tx.datasetRow.findUniqueOrThrow({ where: { id: subject.rowId } });
    const rowVersion = await tx.datasetRowVersion.create({
      data: {
        rowId: subject.rowId,
        version: row.revision,
        operation: DatasetRowVersionOperation.update,
        valuesSnapshot: values,
        relationsSnapshot: Object.fromEntries(relations) as Prisma.InputJsonObject,
        changedFieldIds: [...Object.keys(submittedValues), ...submittedRelations.keys()],
        actorUserId: actor.userId,
      },
    });
    return {
      operation: FormSubmissionOperation.updated,
      rowId: subject.rowId,
      rowVersionId: rowVersion.id,
    };
  }

  /**
   * 将 Form 提交的答案从 Form item ID 映射为 Dataset field ID。
   * 根据 Schema 中每个 property 的 x-form.datasetFieldId 进行转换；
   * 关联字段放入 relations，普通字段放入 values。
   */
  private normalizeAnswers(
    schema: Record<string, unknown>,
    fields: Array<{ id: string; kind: DatasetFieldKind }>,
    answers: Record<string, unknown>,
  ) {
    const properties = schema.properties as Record<string, Record<string, unknown>>;
    const fieldsById = new Map(fields.map((field) => [field.id, field]));
    const values: Record<string, unknown> = {};
    const relations: Record<string, unknown> = {};
    Object.entries(answers).forEach(([itemId, value]) => {
      const extension = properties[itemId]?.['x-form'] as Record<string, unknown> | undefined;
      if (!extension) throw new BadRequestException(`Unknown Form item: ${itemId}`);
      const fieldId = extension.datasetFieldId as string;
      const field = fieldsById.get(fieldId);
      if (!field) throw new ConflictException(`Mapped Dataset field is unavailable: ${fieldId}`);
      // 关联字段与普通字段分桶。
      if (field.kind === DatasetFieldKind.relation) relations[fieldId] = value;
      else values[fieldId] = value;
    });
    return { relations, values };
  }

  /**
   * 为 Join Request 提交生成身份字段值。
   * 姓名和邮箱从当前登录用户的 User 记录读取，忽略客户端提交的任何值。
   * 仅 guest 成员可提交加入申请。
   */
  private async joinIdentityValues(
    workspaceId: number,
    actor: AuthenticatedActor | null,
    fields: Array<{ id: string; systemKey: string | null }>,
  ): Promise<Prisma.InputJsonObject> {
    if (!actor) throw new UnauthorizedException('Join Request Forms require authentication');
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: actor.userId } },
      include: { memberType: true, user: true },
    });
    if (!member || member.memberType.slug !== 'guest') {
      throw new ConflictException('Only guest members may submit Join Requests');
    }
    const ids = new Map(fields.map((field) => [field.systemKey, field.id]));
    if (!ids.get('applicant_name') || !ids.get('applicant_email')) {
      throw new ConflictException('Join Request identity fields are missing');
    }
    // 服务端写入，不信任客户端值。
    return {
      [ids.get('applicant_name')!]: member.user.name,
      [ids.get('applicant_email')!]: member.user.email,
    };
  }

  /**
   * 从 HTTP User-Agent 解析并写入设备采集值。
   * userAgent → 原始字符串；browser → Edge/Chrome/Firefox/Safari；
   * operatingSystem → Windows/Android/iOS/macOS/Linux。
   * 解析失败时 browser/OS 可为空；userAgent 始终保留原始值。
   */
  private captureValues(
    schema: Record<string, unknown>,
    userAgent: string | undefined,
  ): Prisma.InputJsonObject {
    const root = schema['x-form'] as Record<string, unknown>;
    const capture = root.capture as Record<string, { datasetFieldId: string }>;
    const values: Record<string, Prisma.InputJsonValue> = {};
    if (capture.userAgent && userAgent) values[capture.userAgent.datasetFieldId] = userAgent;
    const browser = this.browserName(userAgent);
    if (capture.browser && browser) values[capture.browser.datasetFieldId] = browser;
    const operatingSystem = this.operatingSystemName(userAgent);
    if (capture.operatingSystem && operatingSystem) {
      values[capture.operatingSystem.datasetFieldId] = operatingSystem;
    }
    return values as Prisma.InputJsonObject;
  }

  /** 从 User-Agent 字符串尽力解析浏览器名称。 */
  private browserName(userAgent?: string): string | null {
    if (!userAgent) return null;
    if (/Edg\//.test(userAgent)) return 'Edge';
    if (/Chrome\//.test(userAgent)) return 'Chrome';
    if (/Firefox\//.test(userAgent)) return 'Firefox';
    if (/Safari\//.test(userAgent) && /Version\//.test(userAgent)) return 'Safari';
    return null;
  }

  /** 从 User-Agent 字符串尽力解析操作系统名称。 */
  private operatingSystemName(userAgent?: string): string | null {
    if (!userAgent) return null;
    if (/Windows NT/.test(userAgent)) return 'Windows';
    if (/Android/.test(userAgent)) return 'Android';
    if (/iPhone|iPad/.test(userAgent)) return 'iOS';
    if (/Mac OS X/.test(userAgent)) return 'macOS';
    if (/Linux/.test(userAgent)) return 'Linux';
    return null;
  }

  /** 将关联关系批量写入 DatasetRelation。 */
  private async writeRelations(
    tx: Prisma.TransactionClient,
    workspaceId: number,
    datasetId: string,
    rowId: string,
    fields: Array<{ id: string; relationTargetDatasetId: string | null }>,
    relations: Map<string, string[]>,
  ): Promise<void> {
    const fieldsById = new Map(fields.map((field) => [field.id, field]));
    const data = [...relations.entries()].flatMap(([fieldId, targetIds]) => targetIds.map(
      (targetRowId, position) => ({
        workspaceId,
        sourceDatasetId: datasetId,
        sourceRowId: rowId,
        fieldId,
        targetDatasetId: fieldsById.get(fieldId)!.relationTargetDatasetId!,
        targetRowId,
        position,
      }),
    ));
    if (data.length > 0) await tx.datasetRelation.createMany({ data });
  }

  /**
   * 合并新旧关联：提交的字段替换旧值，未提交的保留。
   * 用于 update_subject_row 的部分更新场景。
   */
  private mergeRelations(
    existing: Array<{ fieldId: string; position: number; targetRowId: string }>,
    submitted: Map<string, string[]>,
  ): Map<string, string[]> {
    const result = new Map<string, string[]>();
    existing.sort((left, right) => left.position - right.position).forEach((relation) => {
      if (!submitted.has(relation.fieldId)) {
        result.set(relation.fieldId, [
          ...(result.get(relation.fieldId) ?? []),
          relation.targetRowId,
        ]);
      }
    });
    submitted.forEach((targetIds, fieldId) => result.set(fieldId, targetIds));
    return result;
  }

  /** 校验 Form 的开放/关闭时间窗口。 */
  private assertWindow(opensAt: Date | null, closesAt: Date | null): void {
    const now = new Date();
    if (opensAt && now < opensAt) throw new ConflictException('Form is not open yet');
    if (closesAt && now > closesAt) throw new ConflictException('Form is closed');
  }

  /**
   * 幂等检查：若存在相同 idempotencyKey 的提交则返回已有结果，
   * 否则返回 null 继续正常流程。兼容 Prisma 事务内外的 client。
   */
  private async checkIdempotent(
    client: Pick<Prisma.TransactionClient, 'formSubmission'>,
    formId: string,
    idempotencyKey: string | undefined,
    payloadChecksum: string,
  ) {
    if (!idempotencyKey) return null;
    const existing = await client.formSubmission.findUnique({
      where: { formId_idempotencyKey: { formId, idempotencyKey } },
    });
    if (!existing) return null;
    return this.resolveIdempotent(existing, payloadChecksum);
  }

  /**
   * 解析幂等结果。
   * 相同 key + 相同 payload → 返回已有结果；
   * 相同 key + 不同 payload → 409 冲突。
   */
  private resolveIdempotent(
    submission: {
      datasetId: string;
      formId: string;
      formVersionId: string;
      id: string;
      operation: FormSubmissionOperation;
      payloadChecksum: string | null;
      rowId: string;
      rowVersionId: string;
      submittedAt: Date;
      submitterUserId: string | null;
    },
    checksum: string,
  ) {
    if (submission.payloadChecksum !== checksum) {
      throw new ConflictException('Idempotency-Key was already used for a different payload');
    }
    return this.submissionResult(submission);
  }

  /** 将数据库 FormSubmission 记录转换为对外读模型。 */
  private submissionResult(submission: {
    datasetId: string;
    formId: string;
    formVersionId: string;
    id: string;
    operation: FormSubmissionOperation;
    rowId: string;
    rowVersionId: string;
    submittedAt: Date;
    submitterUserId: string | null;
  }) {
    return {
      id: submission.id,
      formId: submission.formId,
      formVersionId: submission.formVersionId,
      datasetId: submission.datasetId,
      rowId: submission.rowId,
      rowVersionId: submission.rowVersionId,
      submitterUserId: submission.submitterUserId,
      operation: submission.operation,
      submittedAt: submission.submittedAt,
    };
  }
}
