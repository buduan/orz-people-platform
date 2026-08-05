import type { ComponentPublicInstance } from 'vue';

/** UInput / UTextarea 暴露的最小聚焦接口，供标题 / 描述内联编辑框使用。 */
export interface FormFieldTitleInput {
  focus: () => void;
}

/** 可被自动聚焦的组件实例（UInput 暴露 inputRef，UTextarea 暴露 textareaRef）。 */
export type FocusableInputInstance =
  | ComponentPublicInstance
  | FormFieldTitleInput
  | { inputRef: FormFieldTitleInput }
  | { textareaRef: FormFieldTitleInput };
