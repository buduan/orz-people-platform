import {
  describe, expect, it, vi,
} from 'vitest';
import * as OTPAuth from 'otpauth';

import { MfaService } from './mfa.service';

class FakeMfaRedis {
  public readonly values = new Map<string, string>();

  public async set(key: string, value: string): Promise<'OK'> {
    this.values.set(key, value);
    return 'OK';
  }

  public async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  public async del(key: string): Promise<number> {
    return Number(this.values.delete(key));
  }
}

describe('TOTP replay protection', () => {
  it('rejects a previously accepted TOTP time step on a new MFA challenge', async () => {
    const redis = new FakeMfaRedis();
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      phone: null,
      status: 'active',
      tokenVersion: 1,
      emailMfaEnabled: false,
      smsMfaEnabled: false,
      totpEnabledAt: null as Date | null,
      totpSecretEncrypted: null as string | null,
      totpLastUsedStep: null as bigint | null,
    };
    const update = vi.fn(async ({ data }: { data: Partial<typeof user> }) => {
      Object.assign(user, data);
      return user;
    });
    const prisma = {
      user: {
        findUniqueOrThrow: vi.fn(async () => user),
        updateMany: vi.fn(async ({ data }: { data: { totpLastUsedStep: bigint } }) => {
          if (user.totpLastUsedStep !== null
            && user.totpLastUsedStep >= data.totpLastUsedStep) return { count: 0 };
          user.totpLastUsedStep = data.totpLastUsedStep;
          return { count: 1 };
        }),
      },
      $transaction: vi.fn(async (callback: (client: unknown) => Promise<void>) => callback({
        user: { update },
      })),
    };
    const sessions = {
      create: vi.fn().mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
        accessTokenExpiresIn: 900,
      }),
    };
    const service = new MfaService(
      prisma as never,
      redis as never,
      {
        challengeTtlSeconds: 300,
        totpEncryptionKey: 'test-encryption-key',
        totpPeriodSeconds: 30,
        webauthnRpName: 'Test',
      } as never,
      {} as never,
      sessions as never,
      { verify: vi.fn().mockResolvedValue(undefined) } as never,
      { record: vi.fn().mockResolvedValue(undefined) } as never,
    );

    const enrollment = await service.beginTotpEnrollment('user-1', { password: 'Valid123!' });
    const totp = new OTPAuth.TOTP({
      secret: enrollment.secret,
      issuer: 'Test',
      label: 'user',
      digits: 6,
      period: 30,
    });
    const code = totp.generate();
    await service.confirmTotpEnrollment('user-1', code);

    const first = await service.continueOrCreateSession(user as never, 'password');
    if (!('challengeId' in first)) throw new Error('Expected MFA challenge');
    await expect(service.complete(first.challengeId, 'totp', code)).resolves.toMatchObject({
      accessToken: 'access',
    });

    const second = await service.continueOrCreateSession(user as never, 'password');
    if (!('challengeId' in second)) throw new Error('Expected MFA challenge');
    await expect(service.complete(second.challengeId, 'totp', code)).rejects.toThrow(
      'MFA code was already used',
    );
  });
});
