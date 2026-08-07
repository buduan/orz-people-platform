import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DatasetFieldKind,
  DatasetSubjectMode,
  DatasetType,
  FormSubmissionAccess,
  FormWriteMode,
} from '@prisma/client';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

import type { JsonSchema } from '@orz-people-platform/types';
import { validateFormSchemaExtensions } from '@orz-people-platform/utils';

/** Form 定义发布时的完整校验上下文。 */
interface DefinitionContext {
  dataset: {
    id: string;
    subjectMode: DatasetSubjectMode;
    type: DatasetType;
  };
  /** 包含当前 Dataset 及其关系目标 Dataset 的全部字段。 */
  fields: Array<{
    archivedAt: Date | null;
    datasetId: string;
    id: string;
    isSystemManaged: boolean;
    kind: DatasetFieldKind;
    relationTargetDatasetId: string | null;
    required: boolean;
    systemKey: string | null;
  }>;
  submissionAccess: FormSubmissionAccess;
  /** 关系目标 Dataset 列表，用于校验关联选项的安全策略。 */
  targetDatasets: Array<{ id: string; type: DatasetType }>;
  writeMode: FormWriteMode;
}

/**
 * Form 定义校验器。
 * 在创建/更新草稿和发布时执行完整的 Schema 结构、字段映射、
 * 业务不变量（特殊 Dataset 限制、写入模式约束、关联选项安全策略）校验。
 */
@Injectable()
export class FormDefinitionValidatorService {
  private readonly ajv: Ajv2020;

  public constructor() {
    // strictRequired: false —— JSON Schema 的 required 由标准校验器处理，
    // 此处仅校验 Schema 结构，不额外要求每个 property 自身声明 required。
    this.ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
    addFormats(this.ajv);
    // 注册 x-form 关键字使 AJV 不会因未知关键字报错。
    this.ajv.addKeyword({ keyword: 'x-form', schemaType: 'object', valid: true });
  }

  /**
   * 执行完整校验：
   * 1. Schema 结构合法性（AJV Draft 2020-12 方言 + x-form 扩展；不要求声明 $schema）
   * 2. Dataset 绑定一致性
   * 3. 字段映射正确性（一对一映射、不可映射系统字段）
   * 4. 关联字段安全策略（目标不可为 members/join_requests）
   * 5. 特殊 Dataset 的业务约束（加入申请须登录、仅支持新增行等）
   * 6. 采集字段校验
   * 7. 必填字段覆盖检查（create_row 模式）
   */
  public validate(schema: Record<string, unknown>, context: DefinitionContext): void {
    if (schema.type !== 'object' || schema.additionalProperties !== false) {
      throw new BadRequestException('Form Schema must be an object and reject additional properties');
    }
    try {
      this.ajv.compile(schema);
      // 平台扩展校验（x-form 命名空间、Form item ID 格式、i18n 等）。
      validateFormSchemaExtensions(schema as JsonSchema);
    } catch (error) {
      throw new BadRequestException(
        `Invalid Form Schema: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const rootExtension = schema['x-form'] as Record<string, unknown>;
    if (rootExtension.datasetId !== context.dataset.id) {
      throw new BadRequestException('Form Schema Dataset binding does not match the Form');
    }

    const fieldsById = new Map(context.fields.map((field) => [field.id, field]));
    const datasetsById = new Map(context.targetDatasets.map((dataset) => [dataset.id, dataset]));
    const properties = schema.properties as Record<string, Record<string, unknown>>;

    // 提取所有 Form item → DatasetField 映射。
    const mappings = Object.entries(properties).map(([itemId, property]) => ({
      itemId,
      extension: property['x-form'] as Record<string, unknown>,
    }));

    // 同一 Schema 中一个 DatasetField 最多被一个 Form item 映射。
    const mappedIds = mappings.map(({ extension }) => extension.datasetFieldId as string);
    if (new Set(mappedIds).size !== mappedIds.length) {
      throw new BadRequestException('A Dataset field cannot be mapped by multiple Form items');
    }

    // 逐项校验字段映射。
    mappings.forEach(({ itemId, extension }) => {
      const fieldId = extension.datasetFieldId as string;
      const field = fieldsById.get(fieldId);
      if (!field || field.archivedAt || field.datasetId !== context.dataset.id) {
        throw new BadRequestException(`Invalid Dataset field mapping for Form item: ${itemId}`);
      }
      if (field.isSystemManaged) {
        throw new BadRequestException(`System-managed field cannot be writable: ${itemId}`);
      }

      // 关联字段额外校验。
      const ui = extension.ui as Record<string, unknown> | undefined;
      if (field.kind === DatasetFieldKind.relation) {
        const target = field.relationTargetDatasetId
          ? datasetsById.get(field.relationTargetDatasetId)
          : undefined;
        // 安全策略：members 和 join_requests Dataset 不可作为公开关联选项源。
        if (!target || target.type === DatasetType.members
          || target.type === DatasetType.join_requests) {
          throw new BadRequestException(`Relation target is not safe for Form options: ${itemId}`);
        }
        this.validateRelationOptions(itemId, ui, field, fieldsById);
      }
    });

    // 校验采集字段（browser、operatingSystem、userAgent）指向正确的系统字段。
    const capture = rootExtension.capture as Record<string, { datasetFieldId: string }>;
    const captureSystemKeys: Record<string, string> = {
      browser: 'device_browser',
      operatingSystem: 'device_operating_system',
      userAgent: 'device_user_agent',
    };
    Object.entries(capture).forEach(([key, setting]) => {
      const field = fieldsById.get(setting.datasetFieldId);
      if (!field || field.datasetId !== context.dataset.id || !field.isSystemManaged
        || field.systemKey !== captureSystemKeys[key]) {
        throw new BadRequestException(`Invalid managed capture field: ${key}`);
      }
    });

    // ---- 特殊 Dataset 业务约束 ----

    // Join Request Form 必须要求登录。
    if (context.dataset.type === DatasetType.join_requests
      && context.submissionAccess !== FormSubmissionAccess.authentication_required) {
      throw new BadRequestException('Join Request Forms require authentication');
    }
    // Join Request 和活动报名 Form 仅支持新增行模式。
    if ((context.dataset.type === DatasetType.join_requests
      || context.dataset.type === DatasetType.activity_registrations)
      && context.writeMode !== FormWriteMode.create_row) {
      throw new BadRequestException('This special Dataset supports create-row Forms only');
    }
    // 更新主体行模式必须登录且 Dataset 开启 subject 绑定。
    if (context.writeMode === FormWriteMode.update_subject_row
      && (context.submissionAccess !== FormSubmissionAccess.authentication_required
        || context.dataset.subjectMode !== DatasetSubjectMode.single_per_user)) {
      throw new BadRequestException('Subject-row update requires authentication and subject binding');
    }
    // 已开启 subject 绑定的 Dataset 的 create_row Form 仍需要登录。
    if (context.writeMode === FormWriteMode.create_row
      && context.dataset.subjectMode === DatasetSubjectMode.single_per_user
      && context.submissionAccess !== FormSubmissionAccess.authentication_required) {
      throw new BadRequestException('Subject-bound Dataset Forms require authentication');
    }
    // create_row 模式需确保所有必填字段均被 Form 映射。
    if (context.writeMode === FormWriteMode.create_row) {
      const missingRequired = context.fields.find((field) => field.datasetId === context.dataset.id
        && !field.archivedAt
        && !field.isSystemManaged
        && field.required
        && !mappedIds.includes(field.id));
      if (missingRequired) {
        throw new BadRequestException(`Required Dataset field is not mapped: ${missingRequired.id}`);
      }
    }
  }

  /**
   * 校验关联字段的 Form 选项配置：
   * - labelFieldId 必须存在且可公开投影（非系统字段、未归档、属于目标 Dataset）
   * - filter 中引用的字段也必须满足相同安全约束
   */
  private validateRelationOptions(
    itemId: string,
    ui: Record<string, unknown> | undefined,
    field: { relationTargetDatasetId: string | null },
    fieldsById: Map<string, DefinitionContext['fields'][number]>,
  ): void {
    const options = ui?.options as Record<string, unknown> | undefined;
    const labelFieldId = options?.labelFieldId;
    if (typeof labelFieldId !== 'string') {
      throw new BadRequestException(`Relation Form item requires labelFieldId: ${itemId}`);
    }
    const labelField = fieldsById.get(labelFieldId);
    if (!labelField || labelField.datasetId !== field.relationTargetDatasetId
      || labelField.archivedAt || labelField.isSystemManaged) {
      throw new BadRequestException(`Relation label field is not publicly projectable: ${itemId}`);
    }
    const filter = options?.filter as Record<string, unknown> | undefined;
    const conditions = (filter?.all ?? filter?.any ?? []) as Array<Record<string, unknown>>;
    conditions.forEach((condition) => {
      const filterField = fieldsById.get(condition.fieldId as string);
      if (!filterField || filterField.datasetId !== field.relationTargetDatasetId
        || filterField.archivedAt || filterField.isSystemManaged) {
        throw new BadRequestException(`Relation filter field is not allowed: ${itemId}`);
      }
    });
  }
}
