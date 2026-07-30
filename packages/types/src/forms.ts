import type { JsonSchema, JsonValue } from './json';

/** 多语言文案映射，key 为 BCP 47 locale。 */
export type LocalizedText = Record<string, string>;

/** Form item 的稳定不透明 ID，格式为 q_ + UUID v4。 */
export type FormItemId = string;

// ---- 枚举常量与类型 ----

/** Form 状态：活跃、已关闭、已归档。 */
export const formStatuses = ['active', 'closed', 'archived'] as const;
export type FormStatus = (typeof formStatuses)[number];

/** Form 版本状态：草稿、已发布（不可变）、已退役。 */
export const formVersionStates = ['draft', 'published', 'retired'] as const;
export type FormVersionState = (typeof formVersionStates)[number];

/** 提交权限：允许匿名 或 必须登录。 */
export const formSubmissionAccesses = ['anonymous_allowed', 'authentication_required'] as const;
export type FormSubmissionAccess = (typeof formSubmissionAccesses)[number];

/** Form 写入模式：新增行 或 更新当前用户关联行。 */
export const formWriteModes = ['create_row', 'update_subject_row'] as const;
export type FormWriteMode = (typeof formWriteModes)[number];

/** 提交操作结果：已创建 或 已更新。 */
export const formSubmissionOperations = ['created', 'updated'] as const;
export type FormSubmissionOperation = (typeof formSubmissionOperations)[number];

// ---- visibleIf 条件表达式 ----

/** visibleIf 叶子操作符集合。 */
export const visibleIfLeafOperators = [
  'equals',
  'not_equals',
  'in',
  'not_in',
  'contains',
  'is_empty',
  'is_not_empty',
] as const;
export type VisibleIfLeafOperator = (typeof visibleIfLeafOperators)[number];

/** 比较型条件：fieldId 的值与固定 value 比较。 */
export interface VisibleIfComparisonExpression {
  fieldId: FormItemId;
  operator: 'contains' | 'equals' | 'not_equals';
  value: JsonValue;
}

/** 集合型条件：fieldId 的值是否在/不在 values 列表中。 */
export interface VisibleIfMembershipExpression {
  fieldId: FormItemId;
  operator: 'in' | 'not_in';
  values: JsonValue[];
}

/** 空值判断条件：fieldId 的值是否为空。 */
export interface VisibleIfEmptyExpression {
  fieldId: FormItemId;
  operator: 'is_empty' | 'is_not_empty';
}

/** 组合条件组：and（全满足）或 or（任一满足）。 */
export interface VisibleIfGroupExpression {
  operator: 'and' | 'or';
  conditions: VisibleIfExpression[];
}

/** 逻辑取反：对嵌套表达式结果取反。 */
export interface VisibleIfNotExpression {
  operator: 'not';
  condition: VisibleIfExpression;
}

/** visibleIf 表达式的联合类型。 */
export type VisibleIfExpression =
  | VisibleIfComparisonExpression
  | VisibleIfEmptyExpression
  | VisibleIfGroupExpression
  | VisibleIfMembershipExpression
  | VisibleIfNotExpression;

// ---- 关联筛选 ----

/** 关联选项筛选操作符。 */
export const relationFilterOperators = [
  'equals',
  'not_equals',
  'in',
  'contains',
  'is_empty',
  'is_not_empty',
] as const;
export type RelationFilterOperator = (typeof relationFilterOperators)[number];

/** 单个筛选条件。valueFrom 引用当前 Form 的另一个 item 值，实现级联筛选。 */
export interface RelationFilterCondition {
  fieldId: string;
  operator: RelationFilterOperator;
  value?: JsonValue;
  valueFrom?: FormItemId;
}

/** 筛选表达式：all（全部满足）或 any（任一满足）。 */
export interface RelationFilterExpression {
  all?: RelationFilterCondition[];
  any?: RelationFilterCondition[];
}

// ---- Form Schema x-orz 扩展 ----

/** Form item 的多语言扩展。 */
export interface FormItemI18n {
  description?: LocalizedText;
  placeholder?: LocalizedText;
  title?: LocalizedText;
}

/** Form item 的 UI 选项（关联筛选、标签字段等）。 */
export interface FormItemUiOptions {
  filter?: RelationFilterExpression;
  labelFieldId?: string;
}

/** Form item 的 UI 配置。 */
export interface FormItemUi {
  options?: FormItemUiOptions;
  placeholder?: LocalizedText;
  widget: string;
}

/** Form item 的 x-orz 扩展（字段映射、i18n、UI、条件显示）。 */
export interface FormItemExtension {
  datasetFieldId: string;
  i18n?: FormItemI18n;
  ui?: FormItemUi;
  visibleIf?: VisibleIfExpression;
}

/** Form 布局节点：section（分组容器）或 markdown（说明文本）。 */
export interface FormLayoutNode {
  children?: FormItemId[];
  id: string;
  markdown?: LocalizedText;
  title?: LocalizedText;
  type: 'markdown' | 'section';
}

/** 单个设备采集字段配置。 */
export interface FormCaptureField {
  datasetFieldId: string;
}

/** 设备信息采集设置。 */
export interface FormCaptureSettings {
  browser?: FormCaptureField;
  operatingSystem?: FormCaptureField;
  userAgent?: FormCaptureField;
}

/** Form 根节点的 x-orz 扩展。 */
export interface FormRootExtension {
  capture: FormCaptureSettings;
  datasetId: string;
  layout: FormLayoutNode[];
  version: 1;
}

// ---- 读模型接口 ----

/** Form 摘要。 */
export interface FormSummary {
  id: string;
  workspaceId: number;
  datasetId: string;
  slug: string;
  status: FormStatus;
  activeVersionId: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

/** Form 版本定义（读模型）。 */
export interface FormVersionDefinition {
  id: string;
  formId: string;
  version: number;
  state: FormVersionState;
  defaultLocale: string;
  nameI18n: LocalizedText;
  descriptionI18n: LocalizedText | null;
  closingMessageI18n: LocalizedText | null;
  opensAt: string | null;
  closesAt: string | null;
  submissionAccess: FormSubmissionAccess;
  writeMode: FormWriteMode;
  /** 完整的 Form JSON Schema（Draft 2020-12 + x-orz 扩展）。 */
  schema: JsonSchema;
  /** Schema 内容的 SHA-256 规范校验和，用于幂等比较。 */
  schemaChecksum: string;
  revision: number;
}

/** 提交记录摘要。 */
export interface FormSubmissionSummary {
  id: string;
  formId: string;
  formVersionId: string;
  datasetId: string;
  rowId: string;
  rowVersionId: string;
  /** 匿名提交时为空。 */
  submitterUserId: string | null;
  operation: FormSubmissionOperation;
  submittedAt: string;
}
