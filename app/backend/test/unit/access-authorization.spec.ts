import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import {
  anonymousActor,
  hasFormRole,
  hasPermission,
} from '../../src/access/actor-context';
import type { ActorContext } from '../../src/access/actor-context';
import { attachActor, REQUIRED_PERMISSIONS } from '../../src/access/access.decorators';
import { PermissionsGuard } from '../../src/access/permissions.guard';
import { SUPER_ADMIN_PERMISSION } from '../../src/access/permission-keys';
import {
  assertFormAccess,
  assertWorkspaceMatches,
  workspaceScope,
} from '../../src/access/record-scope';

function actor(overrides: Partial<ActorContext> = {}): ActorContext {
  return {
    audience: 'authenticated',
    workspaceId: 'ws-1',
    userId: 'user-1',
    workspaceUserId: 'wu-1',
    emailVerified: true,
    isMember: false,
    isSuperAdmin: false,
    disabled: false,
    permissionVersion: 0,
    permissions: new Set(),
    formGrants: new Map(),
    ...overrides,
  };
}

const EMPTY_CLASS = class {};

function handlerRequiring(permissions?: string[]): () => void {
  const handler = (): void => {};

  if (permissions) {
    Reflect.defineMetadata(REQUIRED_PERMISSIONS, permissions, handler);
  }

  return handler;
}

function executionContext(handler: () => void, request: unknown): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => EMPTY_CLASS,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('actor authorization helpers', () => {
  it('grants nothing to an anonymous actor', () => {
    const anonymous = anonymousActor('ws-1');

    expect(anonymous.audience).toBe('anonymous');
    expect(anonymous.isMember).toBe(false);
    expect(hasPermission(anonymous, 'forms.manage')).toBe(false);
  });

  it('super_admin bypasses every permission and form-role check', () => {
    const superAdmin = actor({
      isSuperAdmin: true,
      permissions: new Set([SUPER_ADMIN_PERMISSION]),
    });

    expect(hasPermission(superAdmin, 'anything.at.all')).toBe(true);
    expect(hasFormRole(superAdmin, 'form-1', 'owner')).toBe(true);
  });

  it('a member without grants has no management permission', () => {
    const member = actor({ audience: 'member', isMember: true });

    expect(hasPermission(member, 'forms.manage')).toBe(false);
  });

  it('a per-form grant does not leak to other forms', () => {
    const reviewer = actor({
      formGrants: new Map([['form-1', new Set(['reviewer'])]]),
    });

    expect(hasFormRole(reviewer, 'form-1', 'reviewer')).toBe(true);
    expect(hasFormRole(reviewer, 'form-2', 'reviewer')).toBe(false);
  });
});

describe('record scope helpers', () => {
  it('always scopes queries to the actor server-resolved workspace', () => {
    expect(workspaceScope(actor({ workspaceId: 'ws-42' }))).toEqual({ workspaceId: 'ws-42' });
  });

  it('rejects a claimed workspace id that differs from the actor workspace', () => {
    expect(() => assertWorkspaceMatches(actor({ workspaceId: 'ws-1' }), 'ws-other'))
      .toThrow(ForbiddenException);
  });

  it('authorizes form access via permission or per-form role, else denies', () => {
    const permitted = actor({ permissions: new Set(['forms.review']) });
    const scoped = actor({ formGrants: new Map([['form-1', new Set(['reviewer'])]]) });
    const outsider = actor();

    expect(() => assertFormAccess(permitted, 'form-1', { permission: 'forms.review' }))
      .not.toThrow();
    expect(() => assertFormAccess(scoped, 'form-1', { anyRole: ['reviewer'] }))
      .not.toThrow();
    expect(() => assertFormAccess(outsider, 'form-1', {
      anyRole: ['reviewer'],
      permission: 'forms.review',
    })).toThrow(ForbiddenException);
  });
});

describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());

  it('allows a handler with no required permissions', () => {
    const request = {};
    attachActor(request as never, actor());

    expect(guard.canActivate(executionContext(handlerRequiring(), request))).toBe(true);
  });

  it('denies when the actor lacks a required permission', () => {
    const request = {};
    attachActor(request as never, actor());

    expect(() => guard.canActivate(
      executionContext(handlerRequiring(['forms.manage']), request),
    )).toThrow(ForbiddenException);
  });

  it('allows a super_admin regardless of required permissions', () => {
    const request = {};
    attachActor(request as never, actor({
      isSuperAdmin: true,
      permissions: new Set([SUPER_ADMIN_PERMISSION]),
    }));

    expect(guard.canActivate(
      executionContext(handlerRequiring(['forms.manage', 'config.write']), request),
    )).toBe(true);
  });
});
