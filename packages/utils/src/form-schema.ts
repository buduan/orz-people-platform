import type {
  FormItemExtension,
  FormItemId,
  FormRootExtension,
  JsonSchema,
  JsonSchemaObject,
  JsonValue,
  LocalizedText,
  RelationFilterOperator,
  AvailableIfExpression,
} from '@orz-people-platform/types';
import { relationFilterOperators } from '@orz-people-platform/types';

import { evaluateAvailableIf, parseAvailableIf } from './visible-if';

/** Form item ID 格式：q_ + UUID v4。 */
const formItemIdPattern = /^q_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const filterOperators = new Set<RelationFilterOperator>(relationFilterOperators);

/** oneOf 选项投影（框架无关）。 */
export interface FormChoiceOption {
  label: string;
  value: string | number;
}

/** 将 unknown 断言为 Record 类型。 */
function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

/** 软判断：值为普通对象（非数组、非 null）。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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
    throw new TypeError(`relation filter ${groupKey} must be a non-empty array`);
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

/** 递归收集 availableIf 表达式中引用的所有 fieldId。 */
function referencedAvailableIfFields(expression: AvailableIfExpression): string[] {
  if ('conditions' in expression) return expression.conditions.flatMap(referencedAvailableIfFields);
  if ('condition' in expression) return referencedAvailableIfFields(expression.condition);
  return [expression.fieldId];
}

/** 校验单个 Form item 的 x-form 扩展。 */
function validateItemExtension(
  value: unknown,
  itemIds: ReadonlySet<string>,
): void {
  const extension = asRecord(value, 'Form item x-form');
  assertKeys(extension, ['datasetFieldId', 'i18n', 'ui', 'availableIf'], 'Form item x-form');
  assertString(extension.datasetFieldId, 'Form item datasetFieldId');
  if (extension.i18n !== undefined) validateI18n(extension.i18n, 'Form item i18n');
  if (extension.ui !== undefined) validateUi(extension.ui, itemIds);
  if (extension.availableIf !== undefined) {
    const expression = parseAvailableIf(extension.availableIf);
    // availableIf 引用的 Form item ID 必须存在。
    const missing = referencedAvailableIfFields(expression)
      .find((fieldId) => !itemIds.has(fieldId));
    if (missing) throw new TypeError(`Unknown availableIf Form item: ${missing}`);
  }
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

/** 校验 Form 根 x-form 扩展：版本号、datasetId、多语言文案和采集设置。 */
function validateRootExtension(value: unknown): void {
  const extension = asRecord(value, 'Form root x-form');
  assertKeys(extension, ['capture', 'datasetId', 'i18n', 'version'], 'Form root x-form');
  if (extension.version !== 1) throw new TypeError('Form root x-form version must be 1');
  assertString(extension.datasetId, 'Form root datasetId');
  validateCapture(extension.capture);
  if (extension.i18n !== undefined) validateI18n(extension.i18n, 'Form root i18n');
}

/** 校验 oneOf 选项的 x-form 扩展（i18n 文案）。 */
function validateChoiceExtensions(schema: Record<string, unknown>): void {
  if (!Array.isArray(schema.oneOf)) return;
  schema.oneOf.forEach((rawChoice) => {
    const choice = asRecord(rawChoice, 'Form choice');
    if (choice['x-form'] === undefined) return;
    const extension = asRecord(choice['x-form'], 'Form choice x-form');
    assertKeys(extension, ['i18n'], 'Form choice x-form');
    validateI18n(extension.i18n, 'Form choice i18n');
  });
}

/**
 * 在标准 JSON Schema 校验通过后，校验平台 x-form 扩展的合法性。
 *
 * 校验内容：
 * - Form item ID 格式（q_ + UUID v4）
 * - 每个 property 必须有 x-form 扩展
 * - datasetFieldId、i18n、ui、availableIf 结构正确
 * - 采集设置仅允许已知键
 * - properties 对象键序即字段展示顺序
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
    if (property['x-form'] === undefined) throw new TypeError('Form item x-form is required');
    validateItemExtension(property['x-form'], itemIds);
    validateChoiceExtensions(property);
  });

  validateRootExtension(root['x-form']);
}

// ---- 读路径（软解析，供渲染 / 提交映射；非法结构返回 null / 空值）----

/** 解析多语言文案：优先 locale，其次 fallbackLocale，最后取第一条非空文案。 */
export function resolveLocalizedText(
  map: LocalizedText | undefined,
  locale = 'zh-CN',
  fallbackLocale = 'zh-CN',
): string | undefined {
  if (!map) return undefined;
  if (typeof map[locale] === 'string' && map[locale].length > 0) return map[locale];
  if (
    typeof map[fallbackLocale] === 'string'
    && map[fallbackLocale].length > 0
  ) return map[fallbackLocale];
  return Object.values(map).find((value) => typeof value === 'string' && value.length > 0);
}

/** 读取 Form 根 x-form 扩展；结构不符时返回 null。 */
export function getRootExtension(schema: JsonSchema): FormRootExtension | null {
  if (!isRecord(schema)) return null;
  const extension = schema['x-form'];
  if (!isRecord(extension) || extension.version !== 1) return null;
  if (typeof extension.datasetId !== 'string' || !isRecord(extension.capture)) return null;
  return extension as unknown as FormRootExtension;
}

/** 读取 Form item 的 x-form 扩展。 */
export function getItemExtension(property: unknown): FormItemExtension | null {
  if (!isRecord(property)) return null;
  const extension = property['x-form'];
  if (!isRecord(extension) || typeof extension.datasetFieldId !== 'string') return null;
  return extension as unknown as FormItemExtension;
}

/** 读取 schema.properties 映射。 */
export function getSchemaProperties(
  schema: JsonSchema,
): Record<string, JsonSchemaObject> | null {
  if (!isRecord(schema) || !isRecord(schema.properties)) return null;
  return schema.properties as Record<string, JsonSchemaObject>;
}

/** 读取根 required 列表。 */
export function getRequiredItemIds(schema: JsonSchema): ReadonlySet<string> {
  if (!isRecord(schema) || !Array.isArray(schema.required)) return new Set();
  return new Set(schema.required.filter((id): id is string => typeof id === 'string'));
}

/** 从 oneOf const + choice i18n 推导选项列表。 */
export function getChoiceOptions(
  property: unknown,
  locale = 'zh-CN',
  fallbackLocale = 'zh-CN',
): FormChoiceOption[] {
  if (!isRecord(property) || !Array.isArray(property.oneOf)) return [];
  return property.oneOf.flatMap((rawChoice) => {
    if (!isRecord(rawChoice) || rawChoice.const === undefined) return [];
    const value = rawChoice.const;
    if (typeof value !== 'string' && typeof value !== 'number') return [];
    const extension = isRecord(rawChoice['x-form']) ? rawChoice['x-form'] : undefined;
    const i18n = extension && isRecord(extension.i18n) ? extension.i18n : undefined;
    const titleMap = i18n && isRecord(i18n.title) ? i18n.title as LocalizedText : undefined;
    const label = resolveLocalizedText(titleMap, locale, fallbackLocale) ?? String(value);
    return [{ label, value }];
  });
}

/** 判断 item 在当前 state 下是否可见。 */
export function isItemVisible(
  extension: FormItemExtension | null,
  state: Readonly<Record<string, JsonValue | undefined>>,
): boolean {
  if (!extension?.availableIf) return true;
  return evaluateAvailableIf(extension.availableIf, state);
}

/** 读取单个 property 的默认值。 */
export function getPropertyDefault(property: unknown): JsonValue | undefined {
  if (!isRecord(property) || !('default' in property)) return undefined;
  return property.default as JsonValue;
}

/** 根据 schema 初始化表单 state（仅填充有 default 的项）。 */
export function createInitialFormState(
  schema: JsonSchema,
): Record<FormItemId, JsonValue | undefined> {
  const properties = getSchemaProperties(schema);
  if (!properties) return {};
  return Object.fromEntries(
    Object.entries(properties).flatMap(([itemId, property]) => {
      const value = getPropertyDefault(property);
      return value === undefined ? [] : [[itemId, value]];
    }),
  );
}
