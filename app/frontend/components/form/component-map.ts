import type { Component } from 'vue';
import type { JsonSchemaObject } from '@orz-people-platform/types';

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

export interface FormWidgetDefinition {
  icon: string;
  label: string;
  widget: keyof typeof formComponentMap;
}

/** 编辑器 Palette 使用的最小控件注册信息。 */
export const formWidgetDefinitions: FormWidgetDefinition[] = [
  { widget: 'input', label: '单行文本', icon: 'i-solar-text-field-focus-bold-duotone' },
  { widget: 'textarea', label: '多行文本', icon: 'i-solar-text-square-bold-duotone' },
  { widget: 'checkbox', label: '复选框', icon: 'i-solar-check-square-bold-duotone' },
  { widget: 'radio', label: '单选项', icon: 'i-solar-record-circle-bold-duotone' },
  { widget: 'selector', label: '选择器', icon: 'i-solar-list-check-bold-duotone' },
  { widget: 'cascader', label: '级联选择', icon: 'i-solar-hierarchy-2-bold-duotone' },
  { widget: 'tags-input', label: '标签输入', icon: 'i-solar-tag-bold-duotone' },
];

/** 为 Palette 新增控件生成可继续配置的默认 property Schema。 */
export function createWidgetProperty(
  widget: FormWidgetDefinition['widget'],
  locale: string,
  title: string,
): JsonSchemaObject {
  const choice = widget === 'radio' || widget === 'selector' || widget === 'cascader';
  const array = widget === 'tags-input';
  let schemaType = 'string';
  if (array) schemaType = 'array';
  if (widget === 'checkbox') schemaType = 'boolean';
  return {
    type: schemaType,
    ...(array && { items: { type: 'string' } }),
    ...(choice && {
      oneOf: [
        { const: 'option-1', 'x-form': { i18n: { title: { [locale]: '选项一' } } } },
        { const: 'option-2', 'x-form': { i18n: { title: { [locale]: '选项二' } } } },
      ],
    }),
    'x-form': {
      datasetFieldId: '',
      i18n: {
        title: { [locale]: title },
      },
      ui: { widget },
    },
  };
}

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
