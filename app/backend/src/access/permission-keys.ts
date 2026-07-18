// The single deployment-level bypass permission. A holder passes every
// application authorization check (design §2). Its grant/revoke is guarded so at
// least one valid super admin always remains (task 3.7).
export const SUPER_ADMIN_PERMISSION = 'super_admin';

// Per-form grant roles mirror the Prisma FormGrantRole enum.
export const FORM_GRANT_ROLES = ['owner', 'editor', 'reviewer', 'viewer'] as const;
export type FormGrantRole = (typeof FORM_GRANT_ROLES)[number];
