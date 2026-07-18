import { Inject, Injectable } from '@nestjs/common';

import type { WorkspaceAudience } from '@orz-people-platform/types';

import { anonymousActor } from './actor-context';
import type { ActorContext } from './actor-context';
import type { FormGrantRole } from './permission-keys';
import { SUPER_ADMIN_PERMISSION } from './permission-keys';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceService } from '../workspaces/workspace.service';

export interface AuthenticatedIdentity {
  userId: string;
  email: string;
  emailVerified: boolean;
}

function resolveAudience(flags: {
  isSuperAdmin: boolean;
  hasPermissions: boolean;
  isMember: boolean;
}): WorkspaceAudience {
  if (flags.isSuperAdmin || flags.hasPermissions) {
    return 'admin';
  }

  return flags.isMember ? 'member' : 'authenticated';
}

@Injectable()
export class ActorContextService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WorkspaceService) private readonly workspaces: WorkspaceService,
  ) {}

  public async forAnonymous(): Promise<ActorContext> {
    return anonymousActor(await this.workspaces.requireDefaultWorkspaceId());
  }

  public async forIdentity(identity: AuthenticatedIdentity): Promise<ActorContext> {
    const workspaceId = await this.workspaces.requireDefaultWorkspaceId();

    // Resolve the workspace membership record with its grants. A user with no
    // WorkspaceUser row is a registered non-member (design §2): authenticated
    // audience, no permissions, not a member.
    const workspaceUser = await this.prisma.workspaceUser.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: identity.userId } },
      select: {
        id: true,
        isMember: true,
        disabled: true,
        permissionVersion: true,
        permissionGrants: { select: { permissionKey: true } },
        formGrants: { select: { formId: true, role: true } },
      },
    });

    if (!workspaceUser) {
      return {
        audience: 'authenticated',
        workspaceId,
        userId: identity.userId,
        emailVerified: identity.emailVerified,
        isMember: false,
        isSuperAdmin: false,
        disabled: false,
        permissionVersion: 0,
        permissions: new Set(),
        formGrants: new Map(),
      };
    }

    const permissions = new Set(workspaceUser.permissionGrants.map((grant) => grant.permissionKey));
    const isSuperAdmin = permissions.has(SUPER_ADMIN_PERMISSION);
    const formGrants = new Map<string, Set<FormGrantRole>>();

    workspaceUser.formGrants.forEach((grant) => {
      const roles = formGrants.get(grant.formId) ?? new Set<FormGrantRole>();
      roles.add(grant.role as FormGrantRole);
      formGrants.set(grant.formId, roles);
    });

    const audience: WorkspaceAudience = resolveAudience({
      isSuperAdmin,
      hasPermissions: permissions.size > 0,
      isMember: workspaceUser.isMember,
    });

    return {
      audience,
      workspaceId,
      userId: identity.userId,
      workspaceUserId: workspaceUser.id,
      emailVerified: identity.emailVerified,
      isMember: workspaceUser.isMember,
      isSuperAdmin,
      disabled: workspaceUser.disabled,
      permissionVersion: workspaceUser.permissionVersion,
      permissions,
      formGrants,
    };
  }
}
