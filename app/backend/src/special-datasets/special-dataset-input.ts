import { ActivityStatus } from '@prisma/client';

import type { DatasetRowValuesInput } from '../datasets/dataset-input';

/** Join Request 审核入参（批准/拒绝共用）。 */
export interface DecideJoinRequestInput {
  /** JoinRequest 的乐观锁版本号。 */
  expectedRevision: number;
  /** 批准时必须指定目标成员类型 ID（非 guest）。 */
  memberTypeId?: string;
  /** 审核备注。 */
  note?: string;
}

/** Join Request 提交入参，与 DatasetRowValuesInput 一致。 */
export type SubmitJoinRequestInput = DatasetRowValuesInput;

/** 创建 Activity 的入参。 */
export interface CreateActivityInput {
  slug: string;
  nameI18n: Record<string, string>;
  descriptionI18n?: Record<string, string>;
  startsAt?: string;
  endsAt?: string;
  timezone?: string;
}

/** 更新 Activity 的入参，携带乐观锁版本号。 */
export interface UpdateActivityInput {
  expectedRevision: number;
  nameI18n?: Record<string, string>;
  descriptionI18n?: Record<string, string>;
  startsAt?: string;
  endsAt?: string;
  timezone?: string;
}

/** 变更 Activity 状态的入参。 */
export interface ChangeActivityStatusInput {
  expectedRevision: number;
  status: ActivityStatus;
}
