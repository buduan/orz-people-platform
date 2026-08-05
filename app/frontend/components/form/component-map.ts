import type { Component } from 'vue';

import FormItemsCascader from './items/Cascader.vue';
import FormItemsCheckbox from './items/Checkbox.vue';
import FormItemsInput from './items/Input.vue';
import FormItemsRadio from './items/Radio.vue';
import FormItemsSelector from './items/Selector.vue';
import FormItemsTagsInput from './items/TagsInput.vue';
import FormItemsTextarea from './items/Textarea.vue';

/**
 * widget 名 → 叶子组件。
 * 每个 items/* 文件对应一种表单数据类型。
 */
export const formComponentMap: Record<string, Component> = {
  input: FormItemsInput,
  textarea: FormItemsTextarea,
  checkbox: FormItemsCheckbox,
  radio: FormItemsRadio,
  selector: FormItemsSelector,
  cascader: FormItemsCascader,
  'tags-input': FormItemsTagsInput,
};

/** 解析 widget 别名到 componentMap 规范名（前端 UI 绑定）。 */
export function resolveWidgetName(widget: string | undefined): string | undefined {
  if (!widget) return undefined;
  if (widget === 'text') return 'input';
  if (widget === 'dataset-select') return 'selector';
  return widget;
}

/** 按 JSON Schema type/format 推导 HTML Input type（前端 UI 绑定）。 */
export function resolveInputType(property: unknown): string {
  if (property === null || typeof property !== 'object' || Array.isArray(property)) {
    return 'text';
  }
  const schema = property as Record<string, unknown>;
  if (schema.type === 'number' || schema.type === 'integer') return 'number';
  if (schema.format === 'email') return 'email';
  if (schema.format === 'uri' || schema.format === 'url') return 'url';
  if (schema.format === 'date') return 'date';
  if (schema.format === 'time') return 'time';
  if (schema.format === 'date-time') return 'datetime-local';
  return 'text';
}

/** 按 widget 名查找叶子组件；未知时返回 undefined。 */
export function resolveFormComponent(widget: string | undefined): Component | undefined {
  const name = resolveWidgetName(widget);
  if (!name) return undefined;
  return formComponentMap[name];
}
