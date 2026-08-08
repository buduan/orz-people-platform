import { describe, expect, it } from 'vitest';

import type { JsonSchema } from '@weave/types';

import { validateFormFilling } from './form-filling-validation';

const choiceId = 'q_00000000-0000-4000-8000-000000000001';
const detailId = 'q_00000000-0000-4000-8000-000000000002';

function schema(): JsonSchema {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      [choiceId]: {
        type: 'string',
        enum: ['yes', 'no'],
        default: 'no',
        'x-form': {
          datasetFieldId: 'field-choice',
          i18n: { title: { 'zh-CN': '是否补充', en: 'Add details' } },
        },
      },
      [detailId]: {
        type: 'string',
        minLength: 3,
        format: 'email',
        'x-form': {
          datasetFieldId: 'field-detail',
          i18n: { title: { 'zh-CN': '联系邮箱', en: 'Contact email' } },
          availableIf: { fieldId: choiceId, operator: 'equals', value: 'yes' },
        },
      },
    },
    required: [choiceId],
    if: { properties: { [choiceId]: { const: 'yes' } }, required: [choiceId] },
    then: { required: [detailId] },
    'x-form': { version: 1, datasetId: 'dataset-1', capture: {} },
  };
}

describe('Form filling validation', () => {
  it('maps missing required and conditional errors to localized Form item IDs', () => {
    const requiredSchema = schema() as Record<string, unknown>;
    const properties = requiredSchema.properties as Record<string, Record<string, unknown>>;
    delete properties[choiceId]?.default;
    const required = validateFormFilling(requiredSchema as JsonSchema, {}, 'zh-CN', 'zh-CN');
    expect(required.valid).toBe(false);
    expect(required.fieldErrors[choiceId]).toBe('是否补充为必填项');

    const conditional = validateFormFilling(
      schema(),
      { [choiceId]: 'yes' },
      'zh-CN',
      'zh-CN',
    );
    expect(conditional.valid).toBe(false);
    expect(conditional.fieldErrors[detailId]).toBe('联系邮箱为必填项');
  });

  it('maps format and constraint errors to the current locale title', () => {
    const result = validateFormFilling(
      schema(),
      { [choiceId]: 'yes', [detailId]: 'x' },
      'en',
      'zh-CN',
    );

    expect(result.valid).toBe(false);
    expect(result.fieldErrors[detailId]).toMatch(/^Contact email：/);
  });

  it('filters unavailable values before validating and returns defaulted payloads', () => {
    const result = validateFormFilling(
      schema(),
      { [detailId]: 'hidden@example.com' },
      'zh-CN',
      'zh-CN',
    );

    expect(result.valid).toBe(true);
    expect(result.answers).toEqual({ [choiceId]: 'no' });
  });

  it('uses a Form-level fallback when no item can be identified', () => {
    const result = validateFormFilling(false, {}, 'zh-CN', 'zh-CN');

    expect(result.valid).toBe(false);
    expect(result.fieldErrors).toEqual({});
    expect(result.formErrors).toEqual(['表单boolean schema is false']);
  });
});
