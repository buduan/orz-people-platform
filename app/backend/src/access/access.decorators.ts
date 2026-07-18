import { SetMetadata } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { ActorContext } from './actor-context';

export const REQUIRED_PERMISSIONS = 'access:required-permissions';
export const ALLOW_ANONYMOUS = 'access:allow-anonymous';

// Requires the actor to hold every listed permission (super_admin bypasses all).
export const RequirePermissions = (
  ...permissions: string[]
) => SetMetadata(REQUIRED_PERMISSIONS, permissions);

// Marks a route reachable without a session; the guard still attaches an
// anonymous ActorContext so downstream code has a uniform actor.
export const AllowAnonymous = () => SetMetadata(ALLOW_ANONYMOUS, true);

interface RequestWithActor extends Request {
  actor?: ActorContext;
}

export function attachActor(request: Request, actor: ActorContext): void {
  (request as RequestWithActor).actor = actor;
}

export function getActor(context: ExecutionContext): ActorContext {
  const request = context.switchToHttp().getRequest<RequestWithActor>();

  if (!request.actor) {
    throw new Error('ActorContext is missing; ensure AuthGuard runs before this handler.');
  }

  return request.actor;
}
