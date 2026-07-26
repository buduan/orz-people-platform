export const permissionRegistry = {
  system_admin: 'system',
  workspace_admin: 'workspace',
  'user.read': 'workspace',
  'user.create': 'workspace',
  'user.update': 'workspace',
  'user.disable': 'workspace',
  'member.read': 'workspace',
  'member.update': 'workspace',
  'member_type.manage': 'workspace',
  'role.read': 'workspace',
  'role.create': 'workspace',
  'role.update': 'workspace',
  'role.delete': 'workspace',
  'role.assign': 'workspace',
  'permission.grant': 'workspace',
  'audit.read': 'workspace',
} as const;

export type PermissionKey = keyof typeof permissionRegistry;
export type PermissionScope = (typeof permissionRegistry)[PermissionKey];

export const permissionKeys = Object.freeze(Object.keys(permissionRegistry) as PermissionKey[]);
export const workspacePermissionKeys = Object.freeze(permissionKeys.filter(
  (key) => permissionRegistry[key] === 'workspace',
));
export const reservedPermissionKeys = ['system_admin', 'workspace_admin'] as const;

export function isPermissionKey(value: string): value is PermissionKey {
  return Object.hasOwn(permissionRegistry, value);
}
