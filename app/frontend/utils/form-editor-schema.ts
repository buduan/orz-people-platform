import type {
  FormDraftDefinitionInput,
  JsonSchemaObject,
  LocalizedText,
} from '@weave/types';
import {
  resolveLocalizedText,
  validateFormSchemaExtensions,
} from '@weave/utils';
import { orderFormLocales } from './form-locales';

type FormI18nKey = 'description' | 'placeholder' | 'title';

function asSchemaObject(value: unknown): JsonSchemaObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonSchemaObject
    : null;
}

function getRootI18n(schema: JsonSchemaObject): Record<FormI18nKey, LocalizedText> {
  const root = schema['x-form'] as Record<string, unknown>;
  root.i18n ??= {};
  return root.i18n as Record<FormI18nKey, LocalizedText>;
}

function getProperty(
  schema: JsonSchemaObject,
  fieldId: string,
): JsonSchemaObject | null {
  const properties = asSchemaObject(schema.properties);
  return properties ? asSchemaObject(properties[fieldId]) : null;
}

function getPropertyI18n(property: JsonSchemaObject): Record<FormI18nKey, LocalizedText> {
  const extension = property['x-form'] as Record<string, unknown>;
  extension.i18n ??= {};
  return extension.i18n as Record<FormI18nKey, LocalizedText>;
}

export function collectFormLocales(definition: FormDraftDefinitionInput): string[] {
  const locales = new Set<string>([
    definition.defaultLocale,
    ...Object.keys(definition.nameI18n),
    ...Object.keys(definition.descriptionI18n ?? {}),
    ...Object.keys(definition.closingMessageI18n ?? {}),
  ]);
  const root = definition.schema['x-form'] as Record<string, unknown> | undefined;
  const rootI18n = root?.i18n as Record<string, LocalizedText> | undefined;
  Object.values(rootI18n ?? {}).forEach((map) => Object.keys(map).forEach((locale) => {
    locales.add(locale);
  }));
  const properties = asSchemaObject(definition.schema.properties) ?? {};
  Object.values(properties).forEach((rawProperty) => {
    const property = asSchemaObject(rawProperty);
    if (!property) return;
    const extension = property['x-form'] as Record<string, unknown> | undefined;
    const i18n = extension?.i18n as Record<string, LocalizedText> | undefined;
    Object.values(i18n ?? {}).forEach((map) => Object.keys(map).forEach((locale) => {
      locales.add(locale);
    }));
    if (!Array.isArray(property.oneOf)) return;
    property.oneOf.forEach((rawChoice) => {
      const choice = asSchemaObject(rawChoice);
      const choiceExtension = choice?.['x-form'] as Record<string, unknown> | undefined;
      const choiceI18n = choiceExtension?.i18n as Record<string, LocalizedText> | undefined;
      Object.values(choiceI18n ?? {}).forEach((map) => Object.keys(map).forEach((locale) => {
        locales.add(locale);
      }));
    });
  });
  return orderFormLocales(definition.defaultLocale, locales);
}

export function addFormLocale(definition: FormDraftDefinitionInput, locale: string): void {
  const fallback = resolveLocalizedText(
    definition.nameI18n,
    definition.defaultLocale,
    definition.defaultLocale,
  ) ?? '';
  const { nameI18n } = definition;
  nameI18n[locale] ??= fallback;
  const rootI18n = getRootI18n(definition.schema);
  rootI18n.title ??= {};
  rootI18n.title[locale] ??= resolveLocalizedText(
    rootI18n.title,
    definition.defaultLocale,
    definition.defaultLocale,
  ) ?? fallback;
}

export function setFormTitle(
  definition: FormDraftDefinitionInput,
  locale: string,
  value: string,
): void {
  const { nameI18n } = definition;
  nameI18n[locale] = value;
  const i18n = getRootI18n(definition.schema);
  i18n.title ??= {};
  i18n.title[locale] = value;
}

export function setFieldLocalizedText(
  schema: JsonSchemaObject,
  fieldId: string,
  key: FormI18nKey,
  locale: string,
  value: string,
): void {
  const property = getProperty(schema, fieldId);
  if (!property) return;
  const i18n = getPropertyI18n(property);
  i18n[key] ??= {};
  i18n[key][locale] = value;
}

export function setChoiceLocalizedTitle(
  schema: JsonSchemaObject,
  fieldId: string,
  index: number,
  locale: string,
  value: string,
): void {
  const property = getProperty(schema, fieldId);
  const choice = property && Array.isArray(property.oneOf)
    ? asSchemaObject(property.oneOf[index])
    : null;
  if (!choice) return;
  const extension = choice['x-form'] as Record<string, unknown>;
  extension.i18n ??= {};
  const i18n = extension.i18n as Record<'title', LocalizedText>;
  i18n.title ??= {};
  i18n.title[locale] = value;
}

export function parseAndValidateFormSource(source: string): JsonSchemaObject {
  const parsed = JSON.parse(source) as unknown;
  const schema = asSchemaObject(parsed);
  if (!schema || schema.type !== 'object' || schema.additionalProperties !== false) {
    throw new TypeError('Form Schema 必须是 type=object 且 additionalProperties=false 的对象。');
  }
  validateFormSchemaExtensions(schema);
  return schema;
}
