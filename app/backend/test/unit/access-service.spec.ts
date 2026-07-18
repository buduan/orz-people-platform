import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  describe, expect, it, vi,
} from 'vitest';

import { AccessService, REAUTH_MAX_AGE_SECONDS } from '../../src/access/access.service';
import type { ActorContext } from '../../src/access/actor-context';
import { SUPER_ADMIN_PERMISSION } from '../../src/access/permission-keys';
import type { PrismaService } from '../../src/prisma/prisma.service';

function superAdminActor(): ActorContext {
  return {
    audience: 'admin',
    workspaceId: 'ws-1',
    userId: 'admin-1',
    workspaceUserId: 'wu-admin',
    emailVerified: true,
    isMember: false,
    isSuperAdmin: true,
    disabled: false,
    permissionVersion: 1,
    permissions: new Set([SUPER_ADMIN_PERMISSION]),
    formGrants: new Map(),
  };
}

// Minimal in-memory transaction double capturing the calls AccessService makes.
function createPrismaDouble(options: {
  superAdminCount: number;
  existingGrantId?: string;
  targetExists?: boolean;
}) {
  const bumped: string[] = [];
  const deletedGrants: string[] = [];
  const upserts: unknown[] = [];

  const tx = {
    workspaceUser: {
      findFirst: vi.fn(async () => (options.targetExists ?? true ? { id: 'wu-target' } : null)),
      update: vi.fn(async ({ where }: { where: { id: string } }) => {
        bumped.push(where.id);
        return {};
      }),
    },
    workspacePermissionGrant: {
      count: vi.fn(async () => options.superAdminCount),
      upsert: vi.fn(async (args: unknown) => {
        upserts.push(args);
        return {};
      }),
      findUnique: vi.fn(async () => (
        options.existingGrantId ? { id: options.existingGrantId } : null
      )),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        deletedGrants.push(where.id);
        return {};
      }),
    },
  };

  const prisma = {
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    session: { deleteMany: vi.fn(async () => ({ count: 3 })) },
  } as unknown as PrismaService;

  return {
    prisma, bumped, deletedGrants, upserts,
  };
}

describe('AccessService super admin protections', () => {
  it('rejects a grant from a non-super-admin actor', async () => {
    const { prisma } = createPrismaDouble({ superAdminCount: 2 });
    const service = new AccessService(prisma);
    const actor = { ...superAdminActor(), isSuperAdmin: false };

    await expect(service.grantSuperAdmin(actor, 'wu-target', new Date()))
      .rejects.toThrow(ForbiddenException);
  });

  it('requires recent re-authentication for a grant', async () => {
    const { prisma } = createPrismaDouble({ superAdminCount: 2 });
    const service = new AccessService(prisma);
    const stale = new Date(Date.now() - (REAUTH_MAX_AGE_SECONDS + 60) * 1000);

    await expect(service.grantSuperAdmin(superAdminActor(), 'wu-target', stale))
      .rejects.toThrow(ForbiddenException);
  });

  it('grants super_admin and bumps the target permission version', async () => {
    const { prisma, bumped, upserts } = createPrismaDouble({ superAdminCount: 2 });
    const service = new AccessService(prisma);

    await service.grantSuperAdmin(superAdminActor(), 'wu-target', new Date());

    expect(upserts).toHaveLength(1);
    expect(bumped).toEqual(['wu-target']);
  });

  it('rejects granting to a target outside the actor workspace', async () => {
    const { prisma } = createPrismaDouble({ superAdminCount: 2, targetExists: false });
    const service = new AccessService(prisma);

    await expect(service.grantSuperAdmin(superAdminActor(), 'wu-missing', new Date()))
      .rejects.toThrow(NotFoundException);
  });

  it('refuses to remove the last super admin', async () => {
    const { prisma, deletedGrants } = createPrismaDouble({
      superAdminCount: 1,
      existingGrantId: 'grant-1',
    });
    const service = new AccessService(prisma);

    await expect(service.revokeSuperAdmin(superAdminActor(), 'wu-target', new Date()))
      .rejects.toThrow(ConflictException);
    expect(deletedGrants).toEqual([]);
  });

  it('revokes super_admin and bumps version when others remain', async () => {
    const { prisma, deletedGrants, bumped } = createPrismaDouble({
      superAdminCount: 2,
      existingGrantId: 'grant-1',
    });
    const service = new AccessService(prisma);

    await service.revokeSuperAdmin(superAdminActor(), 'wu-target', new Date());

    expect(deletedGrants).toEqual(['grant-1']);
    expect(bumped).toEqual(['wu-target']);
  });

  it('is idempotent when revoking a grant that does not exist', async () => {
    const { prisma, deletedGrants } = createPrismaDouble({ superAdminCount: 2 });
    const service = new AccessService(prisma);

    await expect(service.revokeSuperAdmin(superAdminActor(), 'wu-target', new Date()))
      .resolves.toBeUndefined();
    expect(deletedGrants).toEqual([]);
  });

  it('revokes all sessions for a high-risk demotion', async () => {
    const { prisma } = createPrismaDouble({ superAdminCount: 2 });
    const service = new AccessService(prisma);

    await expect(service.revokeUserSessions(superAdminActor(), 'user-2')).resolves.toBe(3);
  });
});
