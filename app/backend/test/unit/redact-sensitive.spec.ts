import { describe, expect, it } from 'vitest';

import { redactSensitive } from '../../src/observability/redact-sensitive';

describe('sensitive log redaction', () => {
  it('redacts sensitive keys at every nesting level', () => {
    expect(redactSensitive({
      authorization: 'Bearer secret',
      profile: {
        email: 'member@example.com',
        password: 'correct-horse-battery-staple',
      },
      webhookToken: 'secret-token',
    })).toEqual({
      authorization: '[REDACTED]',
      profile: {
        email: 'member@example.com',
        password: '[REDACTED]',
      },
      webhookToken: '[REDACTED]',
    });
  });
});
