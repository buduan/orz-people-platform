import type { WorkspaceAudience } from '@orz-people-platform/types';

import type { FormGrantRole } from './permission-keys';

// Server-side authorization context. Richer than the wire WorkspaceContext:
// carries the member projection, permission version (for cache invalidation),
// workspace-level permission grants and per-form grants. Business services read
// this — never client-supplied role or workspace claims (design §10).
export interface ActorContext {
  audience: WorkspaceAudience;
  workspaceId: string;
  // Undefined for anonymous actors.
  userId?: string;
  workspaceUserId?: string;
  emailVerified: boolean;
  isMember: boolean;
  isSuperAdmin: boolean;
  disabled: boolean;
  permissionVersion: number;
  permissions: ReadonlySet<string>;
  formGrants: ReadonlyMap<string, ReadonlySet<FormGrantRole>>;
}

export function anonymousActor(workspaceId: string): ActorContext {
  return {
    audience: 'anonymous',
    workspaceId,
    emailVerified: false,
    isMember: false,
    isSuperAdmin: false,
    disabled: false,
    permissionVersion: 0,
    permissions: new Set(),
    formGrants: new Map(),
  };
}

export function hasPermission(actor: ActorContext, permission: string): boolean {
  return actor.isSuperAdmin || actor.permissions.has(permission);
}

export function formRoles(actor: ActorContext, formId: string): ReadonlySet<FormGrantRole> {
  return actor.formGrants.get(formId) ?? new Set();
}

export function hasFormRole(
  actor: ActorContext,
  formId: string,
  role: FormGrantRole,
): boolean {
  return actor.isSuperAdmin || formRoles(actor, formId).has(role);
}
