import {
  describe, expect, it, vi,
} from 'vitest';
import { BadRequestException, ConflictException, HttpStatus } from '@nestjs/common';

import { apiStatuses } from '@orz-people-platform/types';

import { AuthService } from './auth.service';

describe('login option discovery', () => {
  it('returns HTTP 400 with account_not_found for an unknown username', async () => {
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue(null) } };
    const rateLimit = { assertDiscoveryAllowed: vi.fn().mockResolvedValue(undefined) };
    const service = new AuthService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      rateLimit as never,
      {} as never,
      {} as never,
      {} as never,
    );

    try {
      await service.loginOptions('missing-user', '203.0.113.8');
      throw new Error('Expected account discovery to fail');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        status: apiStatuses.accountNotFound,
      });
    }
  });
});

describe('password login identifiers', () => {
  it('normalizes email and username and filters phone lookup to verified bindings', async () => {
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const rateLimit = {
      assertAllowed: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      recordFailure: vi.fn().mockResolvedValue(undefined),
    };
    const service = new AuthService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      rateLimit as never,
      {} as never,
    );

    await expect(service.loginWithPassword({
      identifier: ' Admin@Example.COM ',
      password: 'invalid',
    }, '203.0.113.8')).rejects.toThrow('Invalid account or credentials');
    expect(prisma.user.findUnique).toHaveBeenLastCalledWith({
      where: { email: 'admin@example.com' },
    });

    await expect(service.loginWithPassword({
      identifier: ' Example_User ',
      password: 'invalid',
    }, '203.0.113.8')).rejects.toThrow('Invalid account or credentials');
    expect(prisma.user.findUnique).toHaveBeenLastCalledWith({
      where: { username: 'example_user' },
    });

    await expect(service.loginWithPassword({
      identifier: '+8613812345678',
      password: 'invalid',
    }, '203.0.113.8')).rejects.toThrow('Invalid account or credentials');
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { phone: '+8613812345678', phoneVerifiedAt: { not: null } },
    });
  });
});

class FakeRegistrationRedis {
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

function registrationService(options: {
  existingEmail?: boolean;
  firstUsernameTaken?: boolean;
  registerVerified?: ReturnType<typeof vi.fn>;
}) {
  const redis = new FakeRegistrationRedis();
  const users = {
    registerVerified: options.registerVerified ?? vi.fn().mockResolvedValue({
      id: 'user-1',
      tokenVersion: 1,
    }),
  };
  const prisma = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email?: string; username?: string } }) => {
        if (where.email) return options.existingEmail ? { id: 'existing' } : null;
        if (where.username === 'lin' && options.firstUsernameTaken) return { id: 'taken' };
        return null;
      }),
    },
  };
  const otp = {
    consume: vi.fn().mockResolvedValue(undefined),
    requestEmail: vi.fn().mockResolvedValue(undefined),
  };
  const sessions = {
    create: vi.fn().mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
      accessTokenExpiresIn: 900,
    }),
  };
  const service = new AuthService(
    prisma as never,
    users as never,
    otp as never,
    sessions as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    redis as never,
    { challengeTtlSeconds: 300 } as never,
  );
  return {
    otp, prisma, redis, service, sessions, users,
  };
}

describe('verified registration flow', () => {
  it('creates no user before verification and uses the first available generated username', async () => {
    const context = registrationService({ firstUsernameTaken: true });
    const started = await context.service.startRegistration('Lin@example.com', '203.0.113.8');

    expect(context.users.registerVerified).not.toHaveBeenCalled();
    expect([...context.redis.values.keys()].every((key) => !key.includes('lin@example.com'))).toBe(true);

    await context.service.verifyRegistrationCode(started.registrationId, '123456');
    const result = await context.service.completeRegistration({
      registrationId: started.registrationId,
      name: 'Lin',
    });

    expect(context.users.registerVerified).toHaveBeenCalledWith({
      email: 'lin@example.com',
      name: 'Lin',
      username: 'lin-2',
    });
    expect(result).toMatchObject({ outcome: 'authenticated', tokens: { accessToken: 'access' } });
    expect(context.redis.values.size).toBe(0);
  });

  it('rejects existing, unverified and expired registrations', async () => {
    const existing = registrationService({ existingEmail: true });
    await expect(existing.service.startRegistration('lin@example.com', 'ip'))
      .rejects.toThrow('Email is already registered');

    const context = registrationService({});
    const started = await context.service.startRegistration('lin@example.com', 'ip');
    await expect(context.service.completeRegistration({
      registrationId: started.registrationId,
      name: 'Lin',
      username: 'lin',
    })).rejects.toThrow('Registration email is not verified');
    await context.redis.del(`auth:registration:${started.registrationId}`);
    await expect(context.service.verifyRegistrationCode(started.registrationId, '123456'))
      .rejects.toThrow('Registration flow expired');
  });

  it('keeps a verified flow after a correctable username conflict and consumes it once', async () => {
    const registerVerified = vi.fn()
      .mockRejectedValueOnce(new ConflictException('Username is unavailable'))
      .mockResolvedValueOnce({ id: 'user-1', tokenVersion: 1 });
    const context = registrationService({ registerVerified });
    const started = await context.service.startRegistration('lin@example.com', 'ip');
    await context.service.verifyRegistrationCode(started.registrationId, '123456');

    await expect(context.service.completeRegistration({
      registrationId: started.registrationId,
      name: 'Lin',
      username: 'lin',
    })).rejects.toThrow('Username is unavailable');
    await expect(context.service.completeRegistration({
      registrationId: started.registrationId,
      name: 'Lin',
      username: 'lin-new',
    })).resolves.toMatchObject({ outcome: 'authenticated' });
    await expect(context.service.completeRegistration({
      registrationId: started.registrationId,
      name: 'Lin',
      username: 'lin-new',
    })).rejects.toThrow('Registration flow expired');
  });
});
