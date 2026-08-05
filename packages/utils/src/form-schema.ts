import type {
  JsonSchema,
  JsonSchemaObject,
  RelationFilterOperator,
  VisibleIfExpression,
} from '@orz-people-platform/types';
import { relationFilterOperators } from '@orz-people-platform/types';

import { parseVisibleIf } from './visible-if';

/** Form item ID 格式：q_ + UUID v4。 */
const formItemIdPattern = /^q_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const filterOperators = new Set<RelationFilterOperator>(relationFilterOperators);

/** 将 unknown 断言为 Record 类型。 */
function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

/** 断言对象仅包含指定 key。 */
function assertKeys(
  input: Record<string, unknown>,
  allowed: readonly string[],
  name: string,
): void {
  const unknown = Object.keys(input).find((key) => !allowed.includes(key));
  if (unknown) throw new TypeError(`Unknown ${name} property: ${unknown}`);
}

/** 断言值为非空字符串。 */
function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

/** 校验多语言文案 map：非空、locale 为非空字符串、值为字符串。 */
function validateLocaleMap(value: unknown, name: string): void {
  const map = asRecord(value, name);
  if (Object.keys(map).length === 0) throw new TypeError(`${name} must not be empty`);
  Object.entries(map).forEach(([locale, text]) => {
    assertString(locale, `${name} locale`);
    if (typeof text !== 'string') throw new TypeError(`${name}.${locale} must be a string`);
  });
}

/** 校验 Form item 的 i18n 扩展（title、description、placeholder）。 */
function validateI18n(value: unknown, name: string): void {
  const i18n = asRecord(value, name);
  assertKeys(i18n, ['description', 'placeholder', 'title'], name);
  Object.entries(i18n).forEach(([key, map]) => validateLocaleMap(map, `${name}.${key}`));
}

/** 校验单个关联筛选条件：操作符已注册、value 和 valueFrom 互斥。 */
function validateFilterCondition(value: unknown, itemIds: ReadonlySet<string>): void {
  const condition = asRecord(value, 'relation filter condition');
  assertKeys(condition, ['fieldId', 'operator', 'value', 'valueFrom'], 'relation filter');
  assertString(condition.fieldId, 'relation filter fieldId');
  if (!filterOperators.has(condition.operator as RelationFilterOperator)) {
    throw new TypeError(`Unknown relation filter operator: ${String(condition.operator)}`);
  }
  const hasValue = Object.hasOwn(condition, 'value');
  const hasValueFrom = Object.hasOwn(condition, 'valueFrom');
  if (hasValue && hasValueFrom) {
    throw new TypeError('relation filter cannot contain both value and valueFrom');
  }
  if (hasValueFrom) {
    assertString(condition.valueFrom, 'relation filter valueFrom');
    if (!itemIds.has(condition.valueFrom)) {
      throw new TypeError(`Unknown relation filter Form item: ${condition.valueFrom}`);
    }
  }
}

/** 校验关联筛选表达式：必须恰好包含 all 或 any 之一。 */
function validateFilter(value: unknown, itemIds: ReadonlySet<string>): void {
  const filter = asRecord(value, 'relation filter');
  assertKeys(filter, ['all', 'any'], 'relation filter');
  const groups = ['all', 'any'].filter((key) => Object.hasOwn(filter, key));
  if (groups.length !== 1) throw new TypeError('relation filter requires exactly one of all or any');
  const groupKey = groups[0] as 'all' | 'any';
  const conditions = filter[groupKey];
  if (!Array.isArray(conditions) || conditions.length === 0) {
    throw new TypeError(`relation filter ${groups[0]} must be a non-empty array`);
  }
  conditions.forEach((condition) => validateFilterCondition(condition, itemIds));
}

/** 校验 Form item 的 UI 配置（组件类型、关联选项等）。 */
function validateUi(value: unknown, itemIds: ReadonlySet<string>): void {
  const ui = asRecord(value, 'Form item ui');
  assertKeys(ui, ['options', 'widget'], 'Form item ui');
  assertString(ui.widget, 'Form item ui widget');
  if (ui.options === undefined) return;
  const options = asRecord(ui.options, 'Form item options');
  assertKeys(options, ['filter', 'labelFieldId'], 'Form item options');
  if (options.labelFieldId !== undefined) {
    assertString(options.labelFieldId, 'Form item options labelFieldId');
  }
  if (options.filter !== undefined) validateFilter(options.filter, itemIds);
}

/** 递归收集 visibleIf 表达式中引用的所有 fieldId。 */
function referencedVisibleIfFields(expression: VisibleIfExpression): string[] {
  if ('conditions' in expression) return expression.conditions.flatMap(referencedVisibleIfFields);
  if ('condition' in expression) return referencedVisibleIfFields(expression.condition);
  return [expression.fieldId];
}

/** 校验单个 Form item 的 x-orz 扩展。 */
function validateItemExtension(
  value: unknown,
  itemIds: ReadonlySet<string>,
): void {
  const extension = asRecord(value, 'Form item x-orz');
  assertKeys(extension, ['datasetFieldId', 'i18n', 'ui', 'visibleIf'], 'Form item x-orz');
  assertString(extension.datasetFieldId, 'Form item datasetFieldId');
  if (extension.i18n !== undefined) validateI18n(extension.i18n, 'Form item i18n');
  if (extension.ui !== undefined) validateUi(extension.ui, itemIds);
  if (extension.visibleIf !== undefined) {
    const expression = parseVisibleIf(extension.visibleIf);
    // visibleIf 引用的 Form item ID 必须存在。
    const missing = referencedVisibleIfFields(expression).find((fieldId) => !itemIds.has(fieldId));
    if (missing) throw new TypeError(`Unknown visibleIf Form item: ${missing}`);
  }
}

/** 校验 Form 根布局：section 和 markdown 节点的 children 引用必须存在。 */
function validateLayout(value: unknown, itemIds: ReadonlySet<string>): void {
  if (!Array.isArray(value)) throw new TypeError('Form root layout must be an array');
  value.forEach((rawNode) => {
    const node = asRecord(rawNode, 'Form layout node');
    assertKeys(node, ['children', 'id', 'markdown', 'title', 'type'], 'Form layout node');
    assertString(node.id, 'Form layout node id');
    if (node.type !== 'markdown' && node.type !== 'section') {
      throw new TypeError('Form layout node type must be markdown or section');
    }
    if (node.title !== undefined) validateLocaleMap(node.title, 'Form layout title');
    if (node.markdown !== undefined) validateLocaleMap(node.markdown, 'Form layout markdown');
    if (node.children !== undefined) {
      if (!Array.isArray(node.children) || !node.children.every((id) => typeof id === 'string')) {
        throw new TypeError('Form layout children must be Form item IDs');
      }
      const missing = node.children.find((id) => !itemIds.has(id));
      if (missing) throw new TypeError(`Unknown Form layout item: ${missing}`);
    }
  });
}

/** 校验设备采集设置：仅允许 browser、operatingSystem、userAgent 三个键。 */
function validateCapture(value: unknown): void {
  const capture = asRecord(value, 'Form capture');
  assertKeys(capture, ['browser', 'operatingSystem', 'userAgent'], 'Form capture');
  Object.entries(capture).forEach(([key, rawField]) => {
    const field = asRecord(rawField, `Form capture ${key}`);
    assertKeys(field, ['datasetFieldId'], `Form capture ${key}`);
    assertString(field.datasetFieldId, `Form capture ${key} datasetFieldId`);
  });
}

/** 校验 Form 根 x-orz 扩展：版本号、datasetId、布局、采集设置。 */
function validateRootExtension(value: unknown, itemIds: ReadonlySet<string>): void {
  const extension = asRecord(value, 'Form root x-orz');
  assertKeys(extension, ['capture', 'datasetId', 'layout', 'version'], 'Form root x-orz');
  if (extension.version !== 1) throw new TypeError('Form root x-orz version must be 1');
  assertString(extension.datasetId, 'Form root datasetId');
  validateLayout(extension.layout, itemIds);
  validateCapture(extension.capture);
}

/** 校验 oneOf 选项的 x-orz 扩展（i18n 文案）。 */
function validateChoiceExtensions(schema: Record<string, unknown>): void {
  if (!Array.isArray(schema.oneOf)) return;
  schema.oneOf.forEach((rawChoice) => {
    const choice = asRecord(rawChoice, 'Form choice');
    if (choice['x-orz'] === undefined) return;
    const extension = asRecord(choice['x-orz'], 'Form choice x-orz');
    assertKeys(extension, ['i18n'], 'Form choice x-orz');
    validateI18n(extension.i18n, 'Form choice i18n');
  });
}

/**
 * 在标准 JSON Schema 校验通过后，校验平台 x-orz 扩展的合法性。
 *
 * 校验内容：
 * - Form item ID 格式（q_ + UUID v4）
 * - 每个 property 必须有 x-orz 扩展
 * - datasetFieldId、i18n、ui、visibleIf 结构正确
 * - 布局节点引用有效
 * - 采集设置仅允许已知键
 */
export function validateFormSchemaExtensions(
  schema: JsonSchema,
): asserts schema is JsonSchemaObject {
  const root = asRecord(schema, 'Form Schema');
  const properties = asRecord(root.properties, 'Form Schema properties');
  const itemIds = new Set(Object.keys(properties));
  const invalidId = [...itemIds].find((itemId) => !formItemIdPattern.test(itemId));
  if (invalidId) throw new TypeError(`Invalid Form item ID: ${invalidId}`);

  Object.values(properties).forEach((rawProperty) => {
    const property = asRecord(rawProperty, 'Form item Schema');
    if (property['x-orz'] === undefined) throw new TypeError('Form item x-orz is required');
    validateItemExtension(property['x-orz'], itemIds);
    validateChoiceExtensions(property);
  });

  validateRootExtension(root['x-orz'], itemIds);
}
