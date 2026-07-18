import type { ErrorObject } from 'ajv';
import { describe, expect, it } from 'vitest';
import { JSON_SCHEMA_DRAFT_2020_12, ORZ_LOCAL_TIME_FORMAT } from '@orz-people-platform/types';
import { isOrzLocalTime } from '../src/browser';
import { createFormValidator } from '../src/server';

const contractSchema = {
  $schema: JSON_SCHEMA_DRAFT_2020_12,
  type: 'object',
  additionalProperties: false,
  required: ['identity', 'meetingTime', 'startsAt'],
  properties: {
    identity: {
      type: 'object',
      additionalProperties: false,
      required: ['email'],
      properties: {
        email: { type: 'string', format: 'email' },
      },
    },
    meetingTime: { type: 'string', format: ORZ_LOCAL_TIME_FORMAT },
    startsAt: { type: 'string', format: 'date-time' },
  },
} as const;

function errorAt(
  errors: ErrorObject[] | null | undefined,
  instancePath: string,
): ErrorObject | undefined {
  return errors?.find((error) => error.instancePath === instancePath);
}

describe('Draft 2020-12 form validation contract', () => {
  it('accepts registered formats with their platform storage semantics', () => {
    const validate = createFormValidator().compile(contractSchema);

    expect(validate({
      identity: { email: 'member@example.com' },
      meetingTime: '09:30:00',
      startsAt: '2026-07-18T09:30:00+08:00',
    })).toBe(true);
  });

  it('returns nested JSON Pointer paths for format errors', () => {
    const validate = createFormValidator().compile(contractSchema);

    expect(validate({
      identity: { email: 'not-an-email' },
      meetingTime: '09:30:00+08:00',
      startsAt: '2026-07-18T09:30:00',
    })).toBe(false);

    expect(errorAt(validate.errors, '/identity/email')).toMatchObject({ keyword: 'format' });
    expect(errorAt(validate.errors, '/meetingTime')).toMatchObject({ keyword: 'format' });
    expect(errorAt(validate.errors, '/startsAt')).toMatchObject({ keyword: 'format' });
  });

  it('keeps strict mode enabled for unsupported schema keywords', () => {
    const validator = createFormValidator();

    expect(() => validator.compile({
      $schema: JSON_SCHEMA_DRAFT_2020_12,
      type: 'string',
      unsupportedKeyword: true,
    })).toThrow(/strict mode: unknown keyword/u);
  });
});

describe('browser-safe local time contract', () => {
  it.each([
    ['00:00:00', true],
    ['23:59:59', true],
    ['24:00:00', false],
    ['09:60:00', false],
    ['09:30', false],
    ['09:30:00Z', false],
    ['09:30:00+08:00', false],
  ])('validates %s as %s without compiling a schema', (value, expected) => {
    expect(isOrzLocalTime(value)).toBe(expected);
  });
});
