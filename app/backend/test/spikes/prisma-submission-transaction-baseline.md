# Prisma submission transaction spike baseline

This spike validates the transaction shape before the permanent Submission schema is introduced.
It creates a uniquely named PostgreSQL schema, runs concurrent writes, and drops that exact schema
afterward.

## Transaction order

1. Reserve `(workspaceId, formId, actorId, idempotencyKey)` with a database unique key.
2. If the reservation already exists, compare `payloadHash` and replay its committed result.
3. Atomically increment quota with `UPDATE ... WHERE used < quota_limit RETURNING used`.
4. Insert the Submission.
5. Insert its Outbox event.
6. Store the committed Submission id on the idempotency record.
7. Commit all four changes together.

The spike uses PostgreSQL `READ COMMITTED`. A concurrent idempotency insert waits for the winning
transaction, then reads its committed result. A concurrent quota update waits on the counter row,
re-evaluates `used < quota_limit`, and allows exactly one request to take the final slot.

## Verified failures

- Two distinct requests race for one slot: one commits and one receives the quota-full error.
- Two requests use the same key and payload: both receive one Submission id, with one replay.
- A used key is sent with another payload hash: the write is rejected as an idempotency conflict.
- A simulated failure after Outbox insertion rolls back quota, idempotency, Submission, and Outbox.

This proves the database primitive, not the final public API or Prisma models. The production
implementation must keep the same Workspace-scoped unique keys and transaction boundary.

Run the baseline with:

```sh
pnpm --filter @orz-people-platform/backend test:spike:transaction
```
