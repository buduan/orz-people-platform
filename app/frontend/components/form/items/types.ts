export type FormItemValue = string | number;

export interface FormItemOption {
  label?: string;
  value?: FormItemValue;
  description?: string;
  disabled?: boolean;
  children?: FormItemOption[];
  [key: string]: unknown;
}

export type FormItemOptionInput = FormItemOption | FormItemValue;
