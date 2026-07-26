---
name: integrate-backend-audit
description: Integrate consistent audit logging into this repository's NestJS backend. Use when adding or changing backend operations that mutate authentication, security, users, workspaces, members, roles, permissions, or other sensitive state; when handling security-relevant denied or failed operations; or when reviewing whether and how a backend feature should write AuditLog records.
---

# Integrate Backend Audit

Reuse `app/backend/src/audit/audit.module.ts` and `AuditService.record()`. Keep one audit owner per operation and make the smallest change that preserves the business operation's transaction semantics.

## Inspect Before Editing

1. Read `app/backend/src/audit/audit.service.ts`, the owning feature module, the mutation, and its nearest tests.
2. Search existing actions and related resources with `rg "audit\\.record|auditLog\\.create" app/backend/src`.
3. Reuse an existing action name and placement pattern when the same operation already exists.
4. Prefer `AuditService` for new code. Do not refactor unrelated direct `auditLog.create()` calls.

## Decide Whether to Audit

Audit operations that change or enforce:

- authentication methods, credentials, MFA, Passkeys, sessions, or rate limits;
- users, workspace membership, roles, permissions, administrator status, or security policy;
- other state whose actor, target, result, or timing matters during a security investigation.

Do not audit ordinary reads, health checks, or routine validation failures unless the requirement explicitly calls for them. Do not record the same operation in both controller and service; record it next to the mutation, normally in the service.

Use `success` after a completed mutation, `denied` for an intentional security or policy rejection, and `failure` for a security-relevant attempted operation that failed. Do not turn every exception into audit noise.

## Wire the Feature

Import `AuditModule` in the NestJS module that provides the auditing service, then inject `AuditService` through the constructor. Skip either edit if it already exists.

```ts
@Module({
  imports: [AuditModule],
  providers: [ExampleService],
})
export class ExampleModule {}
```

```ts
public constructor(
  private readonly prisma: PrismaService,
  private readonly audit: AuditService,
) {}
```

Pass actor and workspace identifiers from the controller or calling service. Do not couple a domain service to the HTTP request object.

## Build a Stable Entry

Supply the existing `AuditEntry` fields; do not create a duplicate DTO or interface.

| Field | Rule |
| --- | --- |
| `action` | Use a stable lowercase dotted name such as `role.create` or `workspace.member.update`. Never embed IDs. |
| `actorType` | Use `user` for an authenticated action, `system` for automation or an unknown actor, and `bootstrap` only during initial provisioning. |
| `actorUserId` | Include it when the initiating user is known. |
| `resourceType` | Use a stable lowercase snake-case type such as `workspace_member`. |
| `resourceId` | Include the target identifier when one exists. |
| `result` | Use only `success`, `denied`, or `failure`. |
| `workspaceId` | Include it for workspace-scoped operations. |
| `metadata` | Keep only small, investigation-relevant, non-sensitive context. |

Never put passwords, hashes, access or refresh tokens, cookies, authorization headers, OTPs, TOTP secrets, Passkey challenges, private keys, or full credential payloads in an audit entry. Prefer stable IDs over email addresses, phone numbers, names, or other personal data. Do not add per-feature schema fields; extend the central audit contract only when a confirmed cross-cutting requirement needs them.

## Preserve Transaction Semantics

Record a successful mutation inside the same Prisma transaction. Pass `tx` to `record()` so the mutation and its audit row commit or roll back together.

```ts
return this.prisma.$transaction(async (tx) => {
  const resource = await tx.example.update({ where: { id }, data });
  await this.audit.record({
    action: 'example.update',
    actorType: 'user',
    actorUserId,
    resourceType: 'example',
    resourceId: id,
    result: 'success',
    workspaceId,
  }, tx);
  return resource;
});
```

Always await the audit write. Do not use fire-and-forget promises.

If a denied or failed operation causes a transaction rollback, write its audit entry only after that transaction has rolled back; a row written through `tx` would disappear. Record only the expected security-relevant outcome, then preserve and rethrow the original error. For a denial detected before a transaction begins, record immediately before throwing.

## Verify the Integration

1. Add the smallest regression assertion to an existing nearby test when a test harness exists. Mock `AuditService` as `{ record: vi.fn() }` and verify the action, actor, resource, result, workspace, and exactly-once behavior that matters.
2. For transactional success, verify `record()` receives the transaction client. For rollback-related denial or failure, verify the audit write occurs outside that failed transaction.
3. Check the diff for duplicate records and sensitive metadata.
4. Run `pnpm lint`, `pnpm typecheck`, and `pnpm build` from the repository root.

In the handoff, list the added action names, their mutation or failure boundaries, and the verification commands run.
