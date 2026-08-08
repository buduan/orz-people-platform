import { describe, expect, it } from 'vitest';

import type { FormDraftDefinitionInput } from '@orz-people-platform/types';
import {
  addFormLocale,
  collectFormLocales,
  parseAndValidateFormSource,
  setChoiceLocalizedTitle,
  setFieldLocalizedText,
} from './form-editor-schema';

function createDefinition(): FormDraftDefinitionInput {
  return {
    defaultLocale: 'zh-CN',
    nameI18n: { 'zh-CN': '产品研发部' },
    submissionAccess: 'anonymous_allowed',
    writeMode: 'create_row',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        'q_123e4567-e89b-42d3-a456-426614174000': {
          type: 'string',
          oneOf: [{
            const: 'first',
            'x-form': { i18n: { title: { 'zh-CN': '第一项' } } },
          }],
          'x-form': {
            datasetFieldId: 'field-1',
            i18n: { title: { 'zh-CN': '姓名' } },
            ui: { widget: 'radio' },
          },
        },
      },
      required: [],
      'x-form': {
        version: 1,
        datasetId: 'dataset-1',
        capture: {},
        i18n: { title: { 'zh-CN': '产品研发部' } },
      },
    },
  };
}

describe('Form editor locale mutations', () => {
  it('keeps the default locale first and seeds a newly added language', () => {
    const definition = createDefinition();
    addFormLocale(definition, 'en');
    expect(collectFormLocales(definition)).toEqual(['zh-CN', 'en']);
    expect(definition.nameI18n.en).toBe('产品研发部');
  });

  it('writes field and choice translations without changing choice const', () => {
    const definition = createDefinition();
    const fieldId = 'q_123e4567-e89b-42d3-a456-426614174000';
    setFieldLocalizedText(definition.schema, fieldId, 'title', 'en', 'Name');
    setChoiceLocalizedTitle(definition.schema, fieldId, 0, 'en', 'First');
    const property = (
      definition.schema.properties as Record<string, Record<string, unknown>>
    )[fieldId]!;
    const extension = property['x-form'] as {
      i18n: { title: Record<string, string> };
    };
    const choice = (property.oneOf as Array<Record<string, unknown>>)[0]!;
    expect(extension.i18n.title.en).toBe('Name');
    expect(choice.const).toBe('first');
  });

  it('keeps source validation errors local', () => {
    expect(() => parseAndValidateFormSource('{"type":"string"}')).toThrow(/Form Schema/);
  });
});
