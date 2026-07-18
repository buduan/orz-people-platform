import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { getActor, REQUIRED_PERMISSIONS } from './access.decorators';
import { hasPermission } from './actor-context';

// Enforces @RequirePermissions. Must run after AuthGuard, which attaches the
// ActorContext. super_admin bypasses every check (design §2). A missing
// permission returns 403 with a stable code; it never reveals which permission
// was missing beyond the request being forbidden.
@Injectable()
export class PermissionsGuard implements CanActivate {
  public constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const actor = getActor(context);
    const permitted = required.every((permission) => hasPermission(actor, permission));

    if (!permitted) {
      throw new ForbiddenException({ code: 'PERMISSION_DENIED', message: 'Permission denied.' });
    }

    return true;
  }
}
