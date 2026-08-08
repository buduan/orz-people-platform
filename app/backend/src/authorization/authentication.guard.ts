import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';

import type { AuthenticatedActor } from '@weave/types';

import { AuthSettingsService } from '../auth/auth-settings.service';
import { SessionService } from '../auth/session.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  IS_OPTIONAL_AUTHENTICATION_KEY,
  IS_PUBLIC_KEY,
} from './authorization.decorators';
import { AuthorizationService } from './authorization.service';

interface AccessPayload {
  sid: string;
  sub: string;
  typ: string;
  ver: number;
}

interface HttpRequest {
  actor?: AuthenticatedActor;
  headers: { authorization?: string };
}

@Injectable()
export class AuthenticationGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly settings: AuthSettingsService,
    private readonly sessions: SessionService,
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }
    const isOptional = this.reflector.getAllAndOverride<boolean>(
      IS_OPTIONAL_AUTHENTICATION_KEY,
      [context.getHandler(), context.getClass()],
    );
    const request = context.switchToHttp().getRequest<HttpRequest>();
    const authorizationHeader = request.headers.authorization;
    if (!authorizationHeader) {
      if (isOptional) return true;
      throw new UnauthorizedException('Bearer access token required');
    }
    const [scheme, token, ...extra] = authorizationHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid access token');
    }
    if (extra.length > 0) throw new UnauthorizedException('Invalid access token');
    let payload: AccessPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(token, {
        secret: this.settings.jwtSecret,
        audience: this.settings.audience,
        issuer: this.settings.issuer,
      });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
    if (payload.typ !== 'access') throw new UnauthorizedException('Invalid access token');
    const [session, user] = await Promise.all([
      this.sessions.get(payload.sid),
      this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { status: true, tokenVersion: true },
      }),
    ]);
    if (!session || !user || user.status !== UserStatus.active
      || session.userId !== payload.sub
      || session.tokenVersion !== payload.ver
      || user.tokenVersion !== payload.ver) {
      throw new UnauthorizedException('Session is no longer valid');
    }
    request.actor = await this.authorization.resolveActor(payload.sub, payload.sid, 1);
    return true;
  }
}
