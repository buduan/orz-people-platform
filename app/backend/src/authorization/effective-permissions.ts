import {
  isPermissionKey,
  permissionKeys,
  workspacePermissionKeys,
  type PermissionKey,
} from '@weave/types';

export interface DirectPermissionAssignment {
  effect: 'allow' | 'deny';
  permissionKey: string;
}

export interface EffectivePermissionInput {
  directPermissions: DirectPermissionAssignment[];
  isSystemAdmin: boolean;
  isWorkspaceAdmin: boolean;
  rolePermissionKeys: string[];
}

export function resolveEffectivePermissions(input: EffectivePermissionInput): PermissionKey[] {
  if (input.isSystemAdmin) return [...permissionKeys].sort();
  if (input.isWorkspaceAdmin) {
    return ['workspace_admin', ...workspacePermissionKeys].sort() as PermissionKey[];
  }

  const allowed = new Set<PermissionKey>();
  input.rolePermissionKeys.forEach((key) => {
    if (isPermissionKey(key)) allowed.add(key);
  });
  input.directPermissions.forEach(({ effect, permissionKey }) => {
    if (effect === 'allow' && isPermissionKey(permissionKey)) allowed.add(permissionKey);
  });
  input.directPermissions.forEach(({ effect, permissionKey }) => {
    if (effect === 'deny' && isPermissionKey(permissionKey)) allowed.delete(permissionKey);
  });
  return [...allowed].sort();
}
