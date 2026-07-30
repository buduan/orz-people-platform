import type { JsonObject, JsonSchema, JsonValue } from './json';

// ---- 枚举常量与类型 ----

/** Dataset 类型：普通、成员、加入申请、活动报名。 */
export const datasetTypes = [
  'standard',
  'members',
  'join_requests',
  'activity_registrations',
] as const;
export type DatasetType = (typeof datasetTypes)[number];

/** Dataset 状态：活跃、已归档。归档后不可写入新数据。 */
export const datasetStatuses = ['active', 'archived'] as const;
export type DatasetStatus = (typeof datasetStatuses)[number];

/** 主体模式：none（无限制）或 single_per_user（每用户最多一行）。 */
export const datasetSubjectModes = ['none', 'single_per_user'] as const;
export type DatasetSubjectMode = (typeof datasetSubjectModes)[number];

/** Dataset 协作者角色：owner（完全管理）、maintainer（可编辑/发布但不可转移所有权）。 */
export const datasetCollaboratorRoles = ['owner', 'maintainer'] as const;
export type DatasetCollaboratorRole = (typeof datasetCollaboratorRoles)[number];

/** Dataset 字段值类型注册表。 */
export const datasetFieldKinds = [
  'text',
  'long_text',
  'number',
  'boolean',
  'date',
  'time',
  'datetime',
  'email',
  'url',
  'single_select',
  'multi_select',
  'json',
  'relation',
] as const;
export type DatasetFieldKind = (typeof datasetFieldKinds)[number];

/** 关联字段基数：一对一或一对多。 */
export const relationCardinalities = ['one', 'many'] as const;
export type RelationCardinality = (typeof relationCardinalities)[number];

/** 行版本操作类型：创建、更新、删除、恢复。 */
export const datasetRowVersionOperations = ['create', 'update', 'delete', 'restore'] as const;
export type DatasetRowVersionOperation = (typeof datasetRowVersionOperations)[number];

/** 加入申请状态：草稿、已提交、已批准、已拒绝、已撤回。 */
export const joinRequestStatuses = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'withdrawn',
] as const;
export type JoinRequestStatus = (typeof joinRequestStatuses)[number];

/** Activity 状态：草稿、开放报名、已关闭、已归档。 */
export const activityStatuses = ['draft', 'open', 'closed', 'archived'] as const;
export type ActivityStatus = (typeof activityStatuses)[number];

/** 报名状态：已报名、候补、已取消。 */
export const activityRegistrationStatuses = ['registered', 'waitlisted', 'cancelled'] as const;
export type ActivityRegistrationStatus = (typeof activityRegistrationStatuses)[number];

// ---- 读模型接口 ----

/** Dataset 摘要信息。 */
export interface DatasetSummary {
  id: string;
  workspaceId: number;
  name: string;
  slug: string;
  description: string | null;
  type: DatasetType;
  status: DatasetStatus;
  subjectMode: DatasetSubjectMode;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

/** Dataset 字段定义。 */
export interface DatasetFieldDefinition {
  id: string;
  datasetId: string;
  key: string;
  name: string;
  description: string | null;
  kind: DatasetFieldKind;
  /** 字段单个值的 Draft 2020-12 JSON Schema。 */
  valueSchema: JsonSchema;
  /** UI 配置（组件类型、选项等）。 */
  config: JsonObject;
  required: boolean;
  /** 系统管理字段由平台自动维护，不可手动编辑。 */
  isSystemManaged: boolean;
  /** 系统字段的唯一标识 key。 */
  systemKey: string | null;
  relationTargetDatasetId: string | null;
  relationCardinality: RelationCardinality | null;
  position: number;
  revision: number;
  archivedAt: string | null;
}

/** Dataset 行数据（含合并后的关联关系）。 */
export interface DatasetRowData {
  id: string;
  datasetId: string;
  /** 以 fieldId 为 key 的普通字段值。 */
  values: Record<string, JsonValue>;
  /** 以 fieldId 为 key 的关联值；一对一为字符串，一对多为字符串数组。 */
  relations: Record<string, string | string[]>;
  revision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** 行版本摘要（不含完整快照内容）。 */
export interface DatasetRowVersionSummary {
  id: string;
  rowId: string;
  version: number;
  operation: DatasetRowVersionOperation;
  changedFieldIds: string[];
  actorUserId: string | null;
  /** 若此版本由 Form 提交产生，记录 Submission ID。 */
  submissionId: string | null;
  createdAt: string;
}

/** Join Request 摘要。 */
export interface JoinRequestSummary {
  rowId: string;
  datasetId: string;
  status: JoinRequestStatus;
  approvedMemberTypeId: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  revision: number;
}

/** Activity 摘要。 */
export interface ActivitySummary {
  id: string;
  workspaceId: number;
  /** 绑定的报名 Dataset ID。 */
  registrationDatasetId: string;
  slug: string;
  nameI18n: Record<string, string>;
  descriptionI18n: Record<string, string> | null;
  status: ActivityStatus;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string | null;
  revision: number;
}

/** 报名记录摘要。 */
export interface ActivityRegistrationSummary {
  rowId: string;
  activityId: string;
  /** 匿名报名时为空。 */
  participantUserId: string | null;
  status: ActivityRegistrationStatus;
  registeredAt: string;
  cancelledAt: string | null;
  revision: number;
}
