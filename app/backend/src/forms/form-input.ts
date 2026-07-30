import {
  FormSubmissionAccess,
  FormWriteMode,
} from '@prisma/client';

/** 创建 Form 的入参，包含首个草稿版本的全部定义。 */
export interface CreateFormInput {
  datasetId: string;
  slug: string;
  /** 默认语言，必须存在于所有 i18n map 中。 */
  defaultLocale: string;
  nameI18n: Record<string, string>;
  descriptionI18n?: Record<string, string>;
  closingMessageI18n?: Record<string, string>;
  opensAt?: string;
  closesAt?: string;
  /** 控制匿名提交是否允许。 */
  submissionAccess: FormSubmissionAccess;
  /** 新增行还是更新当前用户关联行。 */
  writeMode: FormWriteMode;
  /** 完整的 Form JSON Schema（Draft 2020-12 + x-orz 扩展）。 */
  schema: Record<string, unknown>;
}

/** 更新 Form 草稿版本的入参，携带乐观锁版本号。 */
export interface UpdateFormDraftInput {
  /** 调用方必须传入当前草稿的 revision。 */
  expectedRevision: number;
  defaultLocale: string;
  nameI18n: Record<string, string>;
  descriptionI18n?: Record<string, string>;
  closingMessageI18n?: Record<string, string>;
  opensAt?: string;
  closesAt?: string;
  submissionAccess: FormSubmissionAccess;
  writeMode: FormWriteMode;
  schema: Record<string, unknown>;
}
