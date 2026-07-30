import {
  describe, expect, it, vi,
} from 'vitest';

import { AuthService } from '../../src/auth/auth.service';

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
