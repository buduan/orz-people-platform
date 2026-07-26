import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  describe, expect, it, vi,
} from 'vitest';

import { UsersService } from './users.service';

describe('normalized identity uniqueness', () => {
  it('maps PostgreSQL unique-constraint conflicts to a public conflict error', async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError('duplicate identity', {
      clientVersion: 'test',
      code: 'P2002',
      meta: { target: ['email'] },
    });
    const prisma = { $transaction: vi.fn().mockRejectedValue(duplicate) };
    const service = new UsersService(prisma as never, {} as never, {} as never);

    await expect(service.create({
      email: 'user@example.com',
      username: 'example_user',
      name: 'Example User',
      nickname: 'Example User',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('assigns the default guest type to new users', async () => {
    const createdAt = new Date('2026-07-26T00:00:00.000Z');
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      username: 'example_user',
      name: 'Example User',
      nickname: 'Example User',
      avatarUrl: null,
      phone: null,
      emailVerifiedAt: null,
      phoneVerifiedAt: null,
      status: 'pending',
      createdAt,
      updatedAt: createdAt,
    };
    const tx = {
      auditLog: { create: vi.fn() },
      memberRole: { create: vi.fn() },
      role: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: 'role-1' }) },
      user: { create: vi.fn().mockResolvedValue(user) },
      workspaceMember: { create: vi.fn().mockResolvedValue({ id: 'member-1' }) },
      workspaceMemberType: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'guest-1' }) },
    };
    const prisma = {
      $transaction: vi.fn((callback: (value: typeof tx) => unknown) => callback(tx)),
    };
    const service = new UsersService(prisma as never, {} as never, { record: vi.fn() } as never);

    await service.create({
      email: 'user@example.com',
      username: 'example_user',
      name: 'Example User',
      nickname: 'Example User',
    });

    expect(tx.workspaceMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ memberTypeId: 'guest-1', status: 'pending' }),
    });
  });

  it('creates verified registrations and audit records in one transaction', async () => {
    const tx = {
      auditLog: { create: vi.fn() },
      memberRole: { create: vi.fn() },
      role: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: 'role-1' }) },
      user: { create: vi.fn().mockResolvedValue({ id: 'user-1', tokenVersion: 1 }) },
      workspaceMember: { create: vi.fn().mockResolvedValue({ id: 'member-1' }) },
      workspaceMemberType: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'guest-1' }) },
    };
    const prisma = {
      $transaction: vi.fn((callback: (value: typeof tx) => unknown) => callback(tx)),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const service = new UsersService(prisma as never, {} as never, audit as never);

    await expect(service.registerVerified({
      email: 'user@example.com',
      name: 'User',
      username: 'user',
    })).resolves.toEqual({ id: 'user-1', tokenVersion: 1 });
    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        emailVerifiedAt: expect.any(Date),
        status: 'active',
      }),
    }));
    expect(tx.workspaceMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ joinedAt: expect.any(Date), status: 'active' }),
    });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'user.registration.complete',
      resourceId: 'user-1',
      result: 'success',
    }), tx);
  });
});
