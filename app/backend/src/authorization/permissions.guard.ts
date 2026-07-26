import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedActor, PermissionKey } from '@orz-people-platform/types';

import { REQUIRED_PERMISSIONS_KEY } from './authorization.decorators';

@Injectable()
export class PermissionsGuard implements CanActivate {
  public constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionKey[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<{ actor?: AuthenticatedActor }>();
    if (!request.actor || !required.every((key) => request.actor?.permissions.includes(key))) {
      throw new ForbiddenException('Required permission is missing');
    }
    return true;
  }
}
