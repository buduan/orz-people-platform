/** Form 提交入参。 */
export interface SubmitFormInput {
  /** 以 Form item ID 为 key 的答案。 */
  answers: Record<string, unknown>;
  /** update_subject_row 模式下必须提供当前行的 revision。 */
  expectedRevision?: number;
}
