import { describe, expect, it } from 'vitest';

import { validateEnvironment } from '../../src/config/environment';

const VALID_ENVIRONMENT = {
  API_ORIGIN: 'https://api.example.com',
  APP_ORIGIN: 'https://people.example.com',
  BETTER_AUTH_SECRET: 'test-secret-with-at-least-32-characters',
  DATABASE_URL: 'postgresql://orz:secret@localhost:5432/orz_people',
  MASTER_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  NODE_ENV: 'production',
  PASSKEY_ORIGIN: 'https://people.example.com',
  PASSKEY_RP_ID: 'example.com',
  PORT: '3000',
  REDIS_URL: 'rediss://localhost:6379/0',
  WORKER_HEALTH_PORT: '3002',
};

describe('environment validation', () => {
  it('normalizes a complete production environment', () => {
    expect(validateEnvironment(VALID_ENVIRONMENT)).toMatchObject({
      API_ORIGIN: 'https://api.example.com',
      APP_ORIGIN: 'https://people.example.com',
      NODE_ENV: 'production',
      PASSKEY_RP_ID: 'example.com',
      PORT: 3000,
      WORKER_HEALTH_PORT: 3002,
    });
  });

  it('defaults API_ORIGIN to https://opp.ibuduan.com when unset', () => {
    const { API_ORIGIN, ...withoutApiOrigin } = VALID_ENVIRONMENT;

    expect(validateEnvironment(withoutApiOrigin)).toMatchObject({
      API_ORIGIN: 'https://opp.ibuduan.com',
    });
  });

  it('defaults CORS_ALLOWED_ORIGINS to an empty array when unset', () => {
    expect(validateEnvironment(VALID_ENVIRONMENT)).toMatchObject({
      CORS_ALLOWED_ORIGINS: [],
    });
  });

  it('parses a comma-separated CORS_ALLOWED_ORIGINS list', () => {
    const result = validateEnvironment({
      ...VALID_ENVIRONMENT,
      CORS_ALLOWED_ORIGINS: 'https://a.example.com, https://b.example.com',
    });

    expect(result.CORS_ALLOWED_ORIGINS).toEqual([
      'https://a.example.com',
      'https://b.example.com',
    ]);
  });

  it.each([
    ['short auth secret', { BETTER_AUTH_SECRET: 'short' }],
    ['insecure production origin', { APP_ORIGIN: 'http://people.example.com' }],
    ['insecure production API origin', { API_ORIGIN: 'http://api.example.com' }],
    ['mismatched RP ID', { PASSKEY_RP_ID: 'other.example' }],
    ['invalid master key', { MASTER_ENCRYPTION_KEY: 'not-base64' }],
    ['non-PostgreSQL database URL', { DATABASE_URL: 'mysql://localhost/app' }],
    ['non-Redis Redis URL', { REDIS_URL: 'http://localhost:6379' }],
    ['invalid CORS origin', { CORS_ALLOWED_ORIGINS: 'not-a-url' }],
  ])('rejects %s', (_label, override) => {
    expect(() => validateEnvironment({
      ...VALID_ENVIRONMENT,
      ...override,
    })).toThrow();
  });
});
