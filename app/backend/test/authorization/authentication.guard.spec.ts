import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { AuthenticatedActor } from '@orz-people-platform/types';

import { AuthenticationGuard } from '../../src/authorization/authentication.guard';
import {
  IS_OPTIONAL_AUTHENTICATION_KEY,
  IS_PUBLIC_KEY,
} from '../../src/authorization/authorization.decorators';

const actor: AuthenticatedActor = {
  userId: 'user-1',
  workspaceId: 1,
  sessionId: 'session-1',
  permissions: [],
  isSystemAdmin: false,
  isWorkspaceAdmin: false,
};

function context(request: { actor?: AuthenticatedActor; headers: { authorization?: string } }) {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AuthenticationGuard optional authentication', () => {
  const reflector = { getAllAndOverride: vi.fn() };
  const jwt = { verifyAsync: vi.fn() };
  const sessions = { get: vi.fn() };
  const prisma = { user: { findUnique: vi.fn() } };
  const authorization = { resolveActor: vi.fn() };
  const settings = {
    audience: 'audience',
    issuer: 'issuer',
    jwtSecret: 'secret',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    reflector.getAllAndOverride.mockReturnValue(false);
  });

  function guard() {
    return new AuthenticationGuard(
      reflector as never,
      jwt as never,
      settings as never,
      sessions as never,
      prisma as never,
      authorization as never,
    );
  }

  function metadata(publicRoute: boolean, optional: boolean): void {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return publicRoute;
      if (key === IS_OPTIONAL_AUTHENTICATION_KEY) return optional;
      return false;
    });
  }

  it('keeps public actions fully skipped', async () => {
    metadata(true, false);

    await expect(guard().canActivate(context({ headers: {} }))).resolves.toBe(true);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('allows an optional-auth action without a token', async () => {
    metadata(false, true);
    const request = { headers: {} };

    await expect(guard().canActivate(context(request))).resolves.toBe(true);
    expect(request).not.toHaveProperty('actor');
  });

  it('fully authenticates a supplied optional Bearer token', async () => {
    metadata(false, true);
    jwt.verifyAsync.mockResolvedValue({
      sid: actor.sessionId,
      sub: actor.userId,
      typ: 'access',
      ver: 2,
    });
    sessions.get.mockResolvedValue({ userId: actor.userId, tokenVersion: 2 });
    prisma.user.findUnique.mockResolvedValue({ status: 'active', tokenVersion: 2 });
    authorization.resolveActor.mockResolvedValue(actor);
    const request: { actor?: AuthenticatedActor; headers: { authorization: string } } = {
      headers: { authorization: 'Bearer valid-token' },
    };

    await expect(guard().canActivate(context(request))).resolves.toBe(true);
    expect(jwt.verifyAsync).toHaveBeenCalledWith('valid-token', expect.objectContaining({
      audience: 'audience',
      issuer: 'issuer',
      secret: 'secret',
    }));
    expect(request.actor).toEqual(actor);
  });

  it('rejects an invalid supplied token instead of downgrading to anonymous', async () => {
    metadata(false, true);
    jwt.verifyAsync.mockRejectedValue(new Error('invalid'));

    await expect(guard().canActivate(context({
      headers: { authorization: 'Bearer invalid-token' },
    }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('still requires a token for ordinary protected actions', async () => {
    metadata(false, false);

    await expect(guard().canActivate(context({ headers: {} })))
      .rejects.toThrow('Bearer access token required');
  });
});
