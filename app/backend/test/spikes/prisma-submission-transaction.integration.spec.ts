import { randomUUID } from 'node:crypto';

import { PrismaClient, type Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

interface SubmissionInput {
  actorId: string;
  failAfterOutbox?: boolean;
  formId: string;
  idempotencyKey: string;
  payloadHash: string;
  workspaceId: string;
}

interface SubmissionResult {
  replayed: boolean;
  submissionId: string;
}

interface IdempotencyRow {
  payloadHash: string;
  submissionId: bigint | null;
}

interface IdRow {
  id: string;
}

interface CountRow {
  count: bigint;
}

interface QuotaRow {
  used: number;
}

class SubmissionSpikeError extends Error {
  constructor(readonly code: 'idempotency-conflict' | 'quota-full', message: string) {
    super(message);
  }
}

function quoteIdentifier(identifier: string): string {
  if (!/^[a-z][a-z0-9_]+$/u.test(identifier)) {
    throw new Error('Unsafe PostgreSQL identifier.');
  }

  return `"${identifier}"`;
}

async function createSpikeSchema(prisma: PrismaClient, schema: string): Promise<void> {
  await prisma.$executeRawUnsafe(`CREATE SCHEMA ${schema}`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE ${schema}.quota_counter (
      workspace_id text NOT NULL,
      form_id text NOT NULL,
      used integer NOT NULL DEFAULT 0,
      quota_limit integer NOT NULL,
      PRIMARY KEY (workspace_id, form_id),
      CHECK (used >= 0),
      CHECK (quota_limit >= 0)
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE ${schema}.submission (
      id bigserial PRIMARY KEY,
      workspace_id text NOT NULL,
      form_id text NOT NULL,
      actor_id text NOT NULL,
      payload_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE ${schema}.idempotency_record (
      workspace_id text NOT NULL,
      form_id text NOT NULL,
      actor_id text NOT NULL,
      idempotency_key text NOT NULL,
      payload_hash text NOT NULL,
      result_submission_id bigint,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (workspace_id, form_id, actor_id, idempotency_key),
      FOREIGN KEY (result_submission_id) REFERENCES ${schema}.submission(id)
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE ${schema}.outbox_event (
      id bigserial PRIMARY KEY,
      workspace_id text NOT NULL,
      event_key text NOT NULL,
      event_type text NOT NULL,
      payload jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (workspace_id, event_key)
    )
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO ${schema}.quota_counter (
      workspace_id,
      form_id,
      quota_limit
    ) VALUES
      ('workspace-a', 'last-slot', 1),
      ('workspace-a', 'idempotent', 2),
      ('workspace-a', 'rollback', 2)
  `);
}

async function readExistingResult(
  transaction: Prisma.TransactionClient,
  schema: string,
  input: SubmissionInput,
): Promise<SubmissionResult> {
  const existing = await transaction.$queryRawUnsafe<IdempotencyRow[]>(`
    SELECT
      payload_hash AS "payloadHash",
      result_submission_id AS "submissionId"
    FROM ${schema}.idempotency_record
    WHERE workspace_id = $1
      AND form_id = $2
      AND actor_id = $3
      AND idempotency_key = $4
  `, input.workspaceId, input.formId, input.actorId, input.idempotencyKey);
  const record = existing[0];

  if (!record || record.submissionId === null) {
    throw new Error('Idempotency record has no committed result.');
  }

  if (record.payloadHash !== input.payloadHash) {
    throw new SubmissionSpikeError(
      'idempotency-conflict',
      'Idempotency key was reused with another payload.',
    );
  }

  return {
    replayed: true,
    submissionId: record.submissionId.toString(),
  };
}

async function submit(
  prisma: PrismaClient,
  schema: string,
  input: SubmissionInput,
): Promise<SubmissionResult> {
  return prisma.$transaction(async (transaction) => {
    const reservations = await transaction.$queryRawUnsafe<IdRow[]>(
      `
        INSERT INTO ${schema}.idempotency_record (
          workspace_id,
          form_id,
          actor_id,
          idempotency_key,
          payload_hash
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (workspace_id, form_id, actor_id, idempotency_key)
        DO NOTHING
        RETURNING idempotency_key AS id
      `,
      input.workspaceId,
      input.formId,
      input.actorId,
      input.idempotencyKey,
      input.payloadHash,
    );

    if (reservations.length === 0) {
      return readExistingResult(transaction, schema, input);
    }

    const quota = await transaction.$queryRawUnsafe<QuotaRow[]>(`
      UPDATE ${schema}.quota_counter
      SET used = used + 1
      WHERE workspace_id = $1
        AND form_id = $2
        AND used < quota_limit
      RETURNING used
    `, input.workspaceId, input.formId);

    if (quota.length === 0) {
      throw new SubmissionSpikeError('quota-full', 'The form quota is full.');
    }

    const submissions = await transaction.$queryRawUnsafe<IdRow[]>(`
      INSERT INTO ${schema}.submission (
        workspace_id,
        form_id,
        actor_id,
        payload_hash
      ) VALUES ($1, $2, $3, $4)
      RETURNING id::text AS id
    `, input.workspaceId, input.formId, input.actorId, input.payloadHash);
    const submission = submissions[0];

    if (!submission) {
      throw new Error('Submission insert did not return an id.');
    }

    const eventKey = `submission.created:${input.formId}:${submission.id}`;
    await transaction.$executeRawUnsafe(`
      INSERT INTO ${schema}.outbox_event (
        workspace_id,
        event_key,
        event_type,
        payload
      ) VALUES (
        $1,
        $2,
        'submission.created',
        jsonb_build_object('submissionId', $3::text)
      )
    `, input.workspaceId, eventKey, submission.id);

    if (input.failAfterOutbox) {
      throw new Error('Simulated failure after Outbox insert.');
    }

    await transaction.$executeRawUnsafe(
      `
        UPDATE ${schema}.idempotency_record
        SET result_submission_id = $5::bigint
        WHERE workspace_id = $1
          AND form_id = $2
          AND actor_id = $3
          AND idempotency_key = $4
      `,
      input.workspaceId,
      input.formId,
      input.actorId,
      input.idempotencyKey,
      submission.id,
    );

    return {
      replayed: false,
      submissionId: submission.id,
    };
  }, {
    isolationLevel: 'ReadCommitted',
    maxWait: 10_000,
    timeout: 30_000,
  });
}

async function countForForm(
  prisma: PrismaClient,
  schema: string,
  table: 'idempotency_record' | 'outbox_event' | 'submission',
  formId: string,
): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<CountRow[]>(`
    SELECT count(*) AS count
    FROM ${schema}.${table}
    WHERE workspace_id = 'workspace-a'
      AND ${table === 'outbox_event' ? "payload ->> 'submissionId' IN (SELECT id::text FROM "
    + `${schema}.submission WHERE form_id = $1)` : 'form_id = $1'}
  `, formId);

  return Number(rows[0]?.count ?? 0n);
}

describe('Prisma submission transaction spike', () => {
  it('keeps quota, idempotency, submission, and Outbox atomic under concurrency', async () => {
    const prisma = new PrismaClient();
    const schemaName = `submission_spike_${randomUUID().replaceAll('-', '')}`;
    const schema = quoteIdentifier(schemaName);
    let schemaCreated = false;

    try {
      await createSpikeSchema(prisma, schema);
      schemaCreated = true;

      const quotaRace = await Promise.allSettled([
        submit(prisma, schema, {
          actorId: 'actor-a',
          formId: 'last-slot',
          idempotencyKey: 'quota-a',
          payloadHash: 'hash-a',
          workspaceId: 'workspace-a',
        }),
        submit(prisma, schema, {
          actorId: 'actor-b',
          formId: 'last-slot',
          idempotencyKey: 'quota-b',
          payloadHash: 'hash-b',
          workspaceId: 'workspace-a',
        }),
      ]);
      const quotaSuccesses = quotaRace.filter((result) => result.status === 'fulfilled');
      const quotaFailures = quotaRace.filter((result) => result.status === 'rejected');

      expect(quotaSuccesses).toHaveLength(1);
      expect(quotaFailures).toHaveLength(1);
      expect((quotaFailures[0] as PromiseRejectedResult).reason)
        .toMatchObject({ code: 'quota-full' });

      const duplicateInput = {
        actorId: 'actor-c',
        formId: 'idempotent',
        idempotencyKey: 'same-key',
        payloadHash: 'same-hash',
        workspaceId: 'workspace-a',
      } as const;
      const duplicateResults = await Promise.all([
        submit(prisma, schema, duplicateInput),
        submit(prisma, schema, duplicateInput),
      ]);

      expect(new Set(duplicateResults.map((result) => result.submissionId)).size).toBe(1);
      expect(duplicateResults.map((result) => result.replayed).sort())
        .toEqual([false, true]);
      await expect(submit(prisma, schema, {
        ...duplicateInput,
        payloadHash: 'different-hash',
      })).rejects.toMatchObject({ code: 'idempotency-conflict' });

      await expect(submit(prisma, schema, {
        actorId: 'actor-d',
        failAfterOutbox: true,
        formId: 'rollback',
        idempotencyKey: 'rollback-key',
        payloadHash: 'rollback-hash',
        workspaceId: 'workspace-a',
      })).rejects.toThrow('Simulated failure after Outbox insert.');

      const quotas = await prisma.$queryRawUnsafe<Array<QuotaRow & { formId: string }>>(`
        SELECT form_id AS "formId", used
        FROM ${schema}.quota_counter
        ORDER BY form_id
      `);
      expect(quotas).toEqual([
        { formId: 'idempotent', used: 1 },
        { formId: 'last-slot', used: 1 },
        { formId: 'rollback', used: 0 },
      ]);
      expect(await countForForm(prisma, schema, 'submission', 'last-slot')).toBe(1);
      expect(await countForForm(prisma, schema, 'outbox_event', 'last-slot')).toBe(1);
      expect(await countForForm(prisma, schema, 'submission', 'idempotent')).toBe(1);
      expect(await countForForm(prisma, schema, 'outbox_event', 'idempotent')).toBe(1);
      expect(await countForForm(prisma, schema, 'submission', 'rollback')).toBe(0);
      expect(await countForForm(prisma, schema, 'outbox_event', 'rollback')).toBe(0);
      expect(await countForForm(prisma, schema, 'idempotency_record', 'rollback')).toBe(0);
    } finally {
      if (schemaCreated) {
        await prisma.$executeRawUnsafe(`DROP SCHEMA ${schema} CASCADE`);
      }
      await prisma.$disconnect();
    }
  }, 70_000);
});
