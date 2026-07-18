import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { ActorContext } from './actor-context';
import { SUPER_ADMIN_PERMISSION } from './permission-keys';
import { PrismaService } from '../prisma/prisma.service';

// Fixed window (seconds) within which a re-authentication must have happened for
// a high-risk grant/revoke to be allowed (task 3.7). The AuthGuard supplies the
// session; callers pass the session's most recent verification time.
export const REAUTH_MAX_AGE_SECONDS = 300;

@Injectable()
export class AccessService {
  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // Bumps the target's permission version so cached ActorContext authorization is
  // invalidated on the next request (design §2, task 3.6). Runs inside the given
  // transaction so grant changes and the version bump commit atomically.
  private async bumpPermissionVersion(
    tx: Prisma.TransactionClient,
    workspaceUserId: string,
  ): Promise<void> {
    await tx.workspaceUser.update({
      where: { id: workspaceUserId },
      data: { permissionVersion: { increment: 1 } },
    });
  }

  private async requireGrantableActor(actor: ActorContext, reauthenticatedAt: Date): Promise<void> {
    if (!actor.isSuperAdmin) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Only a super admin can change super admin grants.',
      });
    }

    // Re-authentication requirement for high-risk permission changes.
    const ageSeconds = (Date.now() - reauthenticatedAt.getTime()) / 1000;

    if (ageSeconds > REAUTH_MAX_AGE_SECONDS) {
      throw new ForbiddenException({
        code: 'REAUTH_REQUIRED',
        message: 'Re-authenticate before changing super admin grants.',
      });
    }
  }

  private async countSuperAdmins(
    tx: Prisma.TransactionClient,
    workspaceId: string,
  ): Promise<number> {
    return tx.workspacePermissionGrant.count({
      where: { workspaceId, permissionKey: SUPER_ADMIN_PERMISSION },
    });
  }

  // Grants super_admin to a target workspace user. Requires the acting super
  // admin to have recently re-authenticated. Bumps the target's permission
  // version so the elevation applies on the next request.
  public async grantSuperAdmin(
    actor: ActorContext,
    targetWorkspaceUserId: string,
    reauthenticatedAt: Date,
  ): Promise<void> {
    await this.requireGrantableActor(actor, reauthenticatedAt);

    await this.prisma.$transaction(async (tx) => {
      const target = await tx.workspaceUser.findFirst({
        where: { id: targetWorkspaceUserId, workspaceId: actor.workspaceId },
        select: { id: true },
      });

      if (!target) {
        throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found.' });
      }

      await tx.workspacePermissionGrant.upsert({
        where: {
          workspaceId_workspaceUserId_permissionKey: {
            workspaceId: actor.workspaceId,
            workspaceUserId: target.id,
            permissionKey: SUPER_ADMIN_PERMISSION,
          },
        },
        create: {
          workspaceId: actor.workspaceId,
          workspaceUserId: target.id,
          permissionKey: SUPER_ADMIN_PERMISSION,
          grantedByUserId: actor.userId,
        },
        update: {},
      });

      await this.bumpPermissionVersion(tx, target.id);
    });
  }

  // Revokes super_admin from a target. Refuses to remove the last remaining
  // super admin so the workspace can never be locked out (spec: 超级管理员不可被
  // 意外锁死). Bumps the target's permission version so demotion applies at once.
  public async revokeSuperAdmin(
    actor: ActorContext,
    targetWorkspaceUserId: string,
    reauthenticatedAt: Date,
  ): Promise<void> {
    await this.requireGrantableActor(actor, reauthenticatedAt);

    await this.prisma.$transaction(async (tx) => {
      const grant = await tx.workspacePermissionGrant.findUnique({
        where: {
          workspaceId_workspaceUserId_permissionKey: {
            workspaceId: actor.workspaceId,
            workspaceUserId: targetWorkspaceUserId,
            permissionKey: SUPER_ADMIN_PERMISSION,
          },
        },
        select: { id: true },
      });

      if (!grant) {
        // Idempotent: nothing to revoke.
        return;
      }

      const remaining = await this.countSuperAdmins(tx, actor.workspaceId);

      if (remaining <= 1) {
        throw new ConflictException({
          code: 'LAST_SUPER_ADMIN',
          message: 'Cannot remove the last super admin.',
        });
      }

      await tx.workspacePermissionGrant.delete({ where: { id: grant.id } });
      await this.bumpPermissionVersion(tx, targetWorkspaceUserId);
    });
  }

  // Revokes all of a user's active sessions (high-risk demotion or disable).
  // Deleting session rows invalidates the Better Auth cookie on the next request.
  public async revokeUserSessions(actor: ActorContext, targetUserId: string): Promise<number> {
    if (!actor.isSuperAdmin) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Only a super admin can revoke sessions.',
      });
    }

    const result = await this.prisma.session.deleteMany({ where: { userId: targetUserId } });

    return result.count;
  }
}
