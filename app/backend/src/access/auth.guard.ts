import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { ActorContextService } from './actor-context.service';
import { ALLOW_ANONYMOUS, attachActor } from './access.decorators';
import { AuthService } from '../auth/auth.service';

function toWebHeaders(request: Request): Headers {
  const headers = new Headers();

  Object.entries(request.headers).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => headers.append(key, entry));
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  });

  return headers;
}

// Resolves the Better Auth session into an ActorContext and attaches it to the
// request. Routes marked @AllowAnonymous get an anonymous actor when no session
// is present; all others require a valid, non-disabled account.
@Injectable()
export class AuthGuard implements CanActivate {
  public constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ActorContextService) private readonly actors: ActorContextService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const allowAnonymous = this.reflector.getAllAndOverride<boolean>(ALLOW_ANONYMOUS, [
      context.getHandler(),
      context.getClass(),
    ]) ?? false;

    const session = await this.auth.instance.api.getSession({ headers: toWebHeaders(request) });

    if (!session) {
      if (allowAnonymous) {
        attachActor(request, await this.actors.forAnonymous());
        return true;
      }

      throw new UnauthorizedException({ code: 'AUTH_REQUIRED', message: 'Authentication required.' });
    }

    const actor = await this.actors.forIdentity({
      userId: session.user.id,
      email: session.user.email,
      emailVerified: session.user.emailVerified,
    });

    if (actor.disabled) {
      throw new ForbiddenException({ code: 'ACCOUNT_DISABLED', message: 'Account is disabled.' });
    }

    attachActor(request, actor);

    return true;
  }
}
