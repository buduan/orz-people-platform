import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import {
  isE164Phone,
  normalizeEmail,
  normalizeUsername,
  validatePassword,
} from '@orz-people-platform/utils';

import { RegistrationCompleteDto, RegistrationStartDto } from '../../src/auth/auth.dto';
import { hasViableLoginPath } from '../../src/auth/login-path';

describe('identity normalization and password policy', () => {
  it('normalizes globally unique identity inputs before persistence', async () => {
    const startDto = plainToInstance(RegistrationStartDto, {
      email: '  Admin@Example.COM ',
    });
    const completeDto = plainToInstance(RegistrationCompleteDto, {
      registrationId: '4f41d2e9-ef5c-4dd1-a81e-88922c83de9b',
      username: '  Admin_User ',
      name: 'Admin User',
    });

    expect(await validate(startDto)).toHaveLength(0);
    expect(await validate(completeDto)).toHaveLength(0);
    expect(startDto.email).toBe('admin@example.com');
    expect(completeDto.username).toBe('admin_user');
    expect(normalizeEmail(' A@EXAMPLE.COM ')).toBe('a@example.com');
    expect(normalizeUsername(' Example_User ')).toBe('example_user');
  });

  it('enforces length, visible ASCII and three-of-four categories', () => {
    expect(validatePassword('Abcdef1!x').valid).toBe(true);
    expect(validatePassword('Abcdef12').reason).toBe('length');
    expect(validatePassword(`Aa1${'x'.repeat(125)}`).valid).toBe(true);
    expect(validatePassword(`Aa1${'x'.repeat(126)}`).reason).toBe('length');
    expect(validatePassword('abcdefgh1').reason).toBe('categories');
    expect(validatePassword('Abcdef1 x').reason).toBe('characters');
    expect(validatePassword('Abcdef1x零').reason).toBe('characters');
  });

  it('accepts security-sensitive visible ASCII symbols without special casing', () => {
    expect(validatePassword('Abcdef1"x').valid).toBe(true);
    expect(validatePassword('Abcdef1\\x').valid).toBe(true);
    expect(validatePassword('Abcdef1`x').valid).toBe(true);
  });

  it('recognizes only verified-format E.164 identifiers at the syntax layer', () => {
    expect(isE164Phone('+8613812345678')).toBe(true);
    expect(isE164Phone('13812345678')).toBe(false);
  });
});

describe('MFA login-path safety', () => {
  it('rejects email-only MFA for an email-only passwordless account', () => {
    expect(hasViableLoginPath({
      emailMfaEnabled: true,
      hasPassword: false,
      passkeyCount: 0,
      smsMfaEnabled: false,
      totpEnabled: false,
    })).toBe(false);
  });

  it('allows a distinct password, Passkey, SMS or TOTP path', () => {
    expect(hasViableLoginPath({
      emailMfaEnabled: true,
      hasPassword: true,
      passkeyCount: 0,
      smsMfaEnabled: false,
      totpEnabled: false,
    })).toBe(true);
    expect(hasViableLoginPath({
      emailMfaEnabled: true,
      hasPassword: false,
      passkeyCount: 1,
      smsMfaEnabled: false,
      totpEnabled: false,
    })).toBe(true);
    expect(hasViableLoginPath({
      emailMfaEnabled: false,
      hasPassword: false,
      passkeyCount: 0,
      smsMfaEnabled: true,
      totpEnabled: false,
    })).toBe(true);
  });
});
