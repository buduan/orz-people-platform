import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

import type { AuthenticatedActor, PermissionKey } from '@orz-people-platform/types';

export const IS_PUBLIC_KEY = 'isPublic';
export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const RequirePermissions = (...permissions: PermissionKey[]) => (
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions)
);

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedActor => {
    const request = context.switchToHttp().getRequest<{ actor: AuthenticatedActor }>();
    return request.actor;
  },
);
