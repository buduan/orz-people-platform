import { ForbiddenException } from '@nestjs/common';

import { hasFormRole, hasPermission } from './actor-context';
import type { ActorContext } from './actor-context';
import type { FormGrantRole } from './permission-keys';

// Every scoped query MUST include the actor's server-resolved workspace id.
// Services spread this into their Prisma `where` so a client can never widen
// scope to another workspace (design §1.1, §8). The workspace id comes from the
// ActorContext, not from request parameters.
export function workspaceScope(actor: ActorContext): { workspaceId: string } {
  return { workspaceId: actor.workspaceId };
}

// Rejects a request that names a workspace id differing from the actor's. Used
// where a client-supplied id is present for readability but must not widen scope.
export function assertWorkspaceMatches(actor: ActorContext, claimedWorkspaceId: string): void {
  if (claimedWorkspaceId !== actor.workspaceId) {
    throw new ForbiddenException({
      code: 'WORKSPACE_SCOPE_VIOLATION',
      message: 'Resource is not in the current workspace.',
    });
  }
}

// Authorizes a form action either via a workspace-wide permission or a per-form
// grant role, so scoped reviewers do not need workspace-wide permissions
// (design §2). super_admin bypasses both.
export function assertFormAccess(
  actor: ActorContext,
  formId: string,
  options: { anyRole?: readonly FormGrantRole[]; permission?: string },
): void {
  if (options.permission && hasPermission(actor, options.permission)) {
    return;
  }

  if (options.anyRole?.some((role) => hasFormRole(actor, formId, role))) {
    return;
  }

  if (actor.isSuperAdmin) {
    return;
  }

  // Do not reveal whether the form exists to an unauthorized actor.
  throw new ForbiddenException({
    code: 'FORM_ACCESS_DENIED',
    message: 'You do not have access to this form.',
  });
}
