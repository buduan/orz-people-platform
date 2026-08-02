import { describe, expect, it } from 'vitest';

import { nonInteractiveInput } from '../src/bootstrap-admin';

describe('non-interactive administrator bootstrap', () => {
  it('reads and validates administrator details from environment variables', () => {
    expect(nonInteractiveInput({
      BOOTSTRAP_ADMIN_EMAIL: ' Admin@Example.COM ',
      BOOTSTRAP_ADMIN_USERNAME: ' Admin_User ',
      BOOTSTRAP_ADMIN_NAME: ' System Administrator ',
      BOOTSTRAP_ADMIN_NICKNAME: ' Admin ',
      BOOTSTRAP_ADMIN_PASSWORD: 'A-strong-password-123',
    })).toEqual({
      email: 'admin@example.com',
      username: 'admin_user',
      name: 'System Administrator',
      nickname: 'Admin',
      password: 'A-strong-password-123',
    });
  });

  it('rejects an incomplete environment configuration', () => {
    expect(() => nonInteractiveInput({
      BOOTSTRAP_ADMIN_EMAIL: 'admin@example.com',
    })).toThrow('Missing required environment variables: BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_NICKNAME, BOOTSTRAP_ADMIN_PASSWORD');
  });
});
