import type { ErrorObject } from 'ajv';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

import type {
  FormItemId,
  JsonSchema,
  JsonValue,
} from '@orz-people-platform/types';
import {
  filterVisibleAnswers,
  getItemExtension,
  getSchemaProperties,
  resolveLocalizedText,
} from '@orz-people-platform/utils';

export interface FormFillingValidationResult {
  answers: Record<FormItemId, JsonValue>;
  fieldErrors: Record<FormItemId, string>;
  formErrors: string[];
  valid: boolean;
}

function itemIdFromError(error: ErrorObject): string | undefined {
  if (error.keyword === 'required' && typeof error.params.missingProperty === 'string') {
    return error.params.missingProperty;
  }
  const segment = error.instancePath.split('/').filter(Boolean)[0];
  return segment?.replaceAll('~1', '/').replaceAll('~0', '~');
}

function itemTitle(
  schema: JsonSchema,
  itemId: string,
  locale: string,
  defaultLocale: string,
): string {
  const property = getSchemaProperties(schema)?.[itemId];
  return resolveLocalizedText(
    getItemExtension(property)?.i18n?.title,
    locale,
    defaultLocale,
  ) ?? itemId;
}

/** Validate the currently visible answer snapshot with the published Draft 2020-12 Schema. */
export function validateFormFilling(
  schema: JsonSchema,
  answers: Readonly<Record<FormItemId, JsonValue | undefined>>,
  locale: string,
  defaultLocale: string,
): FormFillingValidationResult {
  const payload = structuredClone(filterVisibleAnswers(schema, answers));
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    strictRequired: false,
    useDefaults: true,
  });
  addFormats(ajv);
  ajv.addKeyword({ keyword: 'x-form', schemaType: 'object', valid: true });
  const validate = ajv.compile(schema);
  const valid = validate(payload);
  const fieldErrors: Record<string, string> = {};
  const formErrors: string[] = [];
  (validate.errors ?? []).forEach((error) => {
    if (error.keyword === 'if' && (validate.errors?.length ?? 0) > 1) return;
    const itemId = itemIdFromError(error);
    if (itemId && getSchemaProperties(schema)?.[itemId]) {
      if (!fieldErrors[itemId]) {
        const title = itemTitle(schema, itemId, locale, defaultLocale);
        fieldErrors[itemId] = error.keyword === 'required'
          ? `${title}为必填项`
          : `${title}${error.message ? `：${error.message}` : '格式不正确'}`;
      }
      return;
    }
    const message = error.message ? `表单${error.message}` : '表单内容不符合要求';
    if (!formErrors.includes(message)) formErrors.push(message);
  });
  return {
    answers: payload,
    fieldErrors,
    formErrors,
    valid: Boolean(valid),
  };
}
