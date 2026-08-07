import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import {
  describe, expect, it,
} from 'vitest';

import {
  canonicalizeJson,
  checksumJson,
  createFormItemId,
  createInitialFormState,
  evaluateAvailableIf,
  getChoiceOptions,
  getItemExtension,
  getRequiredItemIds,
  getRootExtension,
  isItemVisible,
  parseAvailableIf,
  resolveLocalizedText,
  validateFormSchemaExtensions,
} from '@orz-people-platform/utils';

describe('shared Form Schema utilities', () => {
  it('canonicalizes and hashes equivalent JSON objects identically', async () => {
    const first = { nested: { enabled: true }, values: [1, 'two'] };
    const second = { values: [1, 'two'], nested: { enabled: true } };

    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
    await expect(checksumJson(first)).resolves.toBe(await checksumJson(second));
  });

  it('creates stable-format opaque item IDs', () => {
    const first = createFormItemId();
    const second = createFormItemId();

    expect(first).toMatch(/^q_[0-9a-f-]{36}$/);
    expect(second).not.toBe(first);
  });

  it('parses and evaluates nested availableIf expressions', () => {
    const expression = parseAvailableIf({
      operator: 'and',
      conditions: [
        { fieldId: 'q_role', operator: 'in', values: ['student', 'teacher'] },
        {
          operator: 'not',
          condition: { fieldId: 'q_disabled', operator: 'equals', value: true },
        },
      ],
    });

    expect(evaluateAvailableIf(expression, { q_disabled: false, q_role: 'student' })).toBe(true);
    expect(evaluateAvailableIf(expression, { q_disabled: true, q_role: 'student' })).toBe(false);
  });

  it('rejects unknown availableIf syntax and handles absent fields conservatively', () => {
    expect(() => parseAvailableIf({ fieldId: 'q_role', operator: 'execute', value: 'x' }))
      .toThrow('Unknown availableIf operator');
    expect(() => parseAvailableIf({
      fieldId: 'q_role',
      operator: 'equals',
      unexpected: true,
      value: 'student',
    })).toThrow('Unknown availableIf property');

    expect(evaluateAvailableIf(
      parseAvailableIf({ fieldId: 'q_missing', operator: 'is_empty' }),
      {},
    )).toBe(true);
    expect(evaluateAvailableIf(
      parseAvailableIf({ fieldId: 'q_missing', operator: 'not_equals', value: 'student' }),
      {},
    )).toBe(false);
  });

  it('keeps constraints, choices and defaults in standard JSON Schema locations', () => {
    const ajv = new Ajv2020({ strict: true });
    addFormats(ajv);
    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        q_choice: {
          type: 'string',
          maxLength: 3,
          oneOf: [{ const: 'yes' }, { const: 'no' }],
          default: 'no',
        },
      },
    };
    const validate = ajv.compile(schema);

    expect(validate({ q_choice: 'yes' })).toBe(true);
    expect(validate({ q_choice: 'maybe' })).toBe(false);
    expect(validate({ q_choice: 'toolong' })).toBe(false);
    expect(validate({})).toBe(true);
  });

  it('validates locale maps, field references, relation filters and x-form keys', () => {
    const controllingId = 'q_00000000-0000-4000-8000-000000000001';
    const dependentId = 'q_00000000-0000-4000-8000-000000000002';
    const schema = {
      type: 'object',
      properties: {
        [controllingId]: {
          type: 'string',
          'x-form': { datasetFieldId: 'dataset-field-1' },
        },
        [dependentId]: {
          type: 'string',
          'x-form': {
            datasetFieldId: 'dataset-field-2',
            i18n: { title: { 'en-US': 'City', 'zh-CN': '城市' } },
            ui: {
              widget: 'dataset-select',
              options: {
                labelFieldId: 'dataset-field-name',
                filter: {
                  all: [{
                    fieldId: 'dataset-field-country',
                    operator: 'equals',
                    valueFrom: controllingId,
                  }],
                },
              },
            },
            availableIf: { fieldId: controllingId, operator: 'not_equals', value: '' },
          },
        },
      },
      'x-form': {
        version: 1,
        datasetId: 'dataset-1',
        capture: {},
      },
    };

    expect(() => validateFormSchemaExtensions(schema)).not.toThrow();

    const unknownExtension = structuredClone(schema);
    Object.assign(unknownExtension.properties[dependentId]['x-form'], { execute: 'script' });
    expect(() => validateFormSchemaExtensions(unknownExtension))
      .toThrow('Unknown Form item x-form property');

    const missingReference = structuredClone(schema);
    missingReference.properties[dependentId]['x-form'].availableIf.fieldId = 'q_missing';
    expect(() => validateFormSchemaExtensions(missingReference))
      .toThrow('Unknown availableIf Form item');
  });

  it('soft-reads extensions, choices, locale text, and defaults without throwing', () => {
    const itemId = 'q_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const schema = {
      type: 'object',
      properties: {
        [itemId]: {
          type: 'string',
          default: 'engineering',
          oneOf: [
            {
              const: 'engineering',
              'x-form': { i18n: { title: { 'zh-CN': '研发', en: 'Eng' } } },
            },
            { const: 'design' },
          ],
          'x-form': {
            datasetFieldId: 'fld_dept',
            i18n: { title: { 'zh-CN': '部门', en: 'Dept' } },
            ui: { widget: 'radio' },
            availableIf: { fieldId: itemId, operator: 'is_not_empty' },
          },
        },
      },
      required: [itemId],
      'x-form': {
        version: 1,
        datasetId: 'ds_1',
        capture: {},
      },
    };

    expect(resolveLocalizedText({ en: 'Hello', 'zh-CN': '你好' }, 'en')).toBe('Hello');
    expect(resolveLocalizedText({ en: 'Hello' }, 'zh-CN')).toBe('Hello');
    expect(getRootExtension(schema)?.datasetId).toBe('ds_1');
    expect(getItemExtension(schema.properties[itemId])?.ui?.widget).toBe('radio');
    expect(getRequiredItemIds(schema).has(itemId)).toBe(true);
    expect(getChoiceOptions(schema.properties[itemId], 'zh-CN')).toEqual([
      { label: '研发', value: 'engineering' },
      { label: 'design', value: 'design' },
    ]);
    expect(createInitialFormState(schema)).toEqual({ [itemId]: 'engineering' });
    expect(isItemVisible(getItemExtension(schema.properties[itemId]), { [itemId]: 'x' })).toBe(true);
    expect(isItemVisible(getItemExtension(schema.properties[itemId]), {})).toBe(false);
    expect(getRootExtension(true)).toBeNull();
  });
});
