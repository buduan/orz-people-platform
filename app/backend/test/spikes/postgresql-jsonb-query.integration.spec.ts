import { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

interface IdRow {
  id: string;
}

interface ExplainRow {
  'QUERY PLAN': unknown;
}

const CREATE_TABLE_SQL = `
  CREATE TEMP TABLE submission_query_spike (
    id bigint PRIMARY KEY,
    workspace_id text NOT NULL,
    public_data jsonb NOT NULL,
    internal_data jsonb NOT NULL,
    submitted_at timestamptz NOT NULL
  ) ON COMMIT DROP
`;

const INSERT_FIXED_ROWS_SQL = `
  INSERT INTO submission_query_spike (
    id,
    workspace_id,
    public_data,
    internal_data,
    submitted_at
  ) VALUES
    (
      1,
      'workspace-a',
      '{
        "name":"Alice",
        "email":"alice@example.com",
        "note":"Platform engineer",
        "score":92.5,
        "attendees":2,
        "consent":true,
        "department":"engineering",
        "skills":["vue","typescript"],
        "regionPath":["cn","shanghai"],
        "sessions":[{"topic":"orientation"}],
        "eventDate":"2026-07-18",
        "eventTime":"09:30:00",
        "startsAt":"2026-07-18T09:30:00+08:00"
      }'::jsonb,
      '{"reviewStatus":"priority"}'::jsonb,
      '2026-07-18T01:30:00Z'
    ),
    (
      2,
      'workspace-a',
      '{
        "name":"Bob",
        "email":"bob@example.com",
        "note":"Product designer",
        "score":81,
        "attendees":1,
        "consent":false,
        "department":"design",
        "skills":["figma"],
        "regionPath":["cn","beijing"],
        "sessions":[{"topic":"portfolio"}],
        "eventDate":"2026-07-19",
        "eventTime":"10:00:00",
        "startsAt":"2026-07-19T10:00:00+08:00"
      }'::jsonb,
      '{"reviewStatus":"pending"}'::jsonb,
      '2026-07-18T02:00:00Z'
    ),
    (
      3,
      'workspace-a',
      '{
        "name":"Carol",
        "email":"carol@example.com",
        "note":"Frontend engineer",
        "score":92.5,
        "attendees":1,
        "consent":true,
        "department":"engineering",
        "skills":["vue"],
        "regionPath":["cn","shanghai"],
        "sessions":[{"topic":"technical"}],
        "eventDate":"2026-07-20",
        "eventTime":"11:00:00",
        "startsAt":"2026-07-20T11:00:00+08:00"
      }'::jsonb,
      '{"reviewStatus":"pending"}'::jsonb,
      '2026-07-18T03:00:00Z'
    ),
    (
      4,
      'workspace-b',
      '{
        "name":"Alice",
        "email":"alice@example.com",
        "note":"Other workspace",
        "score":99,
        "attendees":2,
        "consent":true,
        "department":"engineering",
        "skills":["vue","typescript"],
        "regionPath":["cn","shanghai"],
        "sessions":[{"topic":"orientation"}],
        "eventDate":"2026-07-18",
        "eventTime":"09:30:00",
        "startsAt":"2026-07-18T09:30:00+08:00"
      }'::jsonb,
      '{"reviewStatus":"priority"}'::jsonb,
      '2026-07-18T01:30:00Z'
    )
`;

const INSERT_PLAN_ROWS_SQL = `
  INSERT INTO submission_query_spike (
    id,
    workspace_id,
    public_data,
    internal_data,
    submitted_at
  )
  SELECT
    series + 100,
    CASE WHEN series <= 5000 THEN 'workspace-a' ELSE 'workspace-b' END,
    jsonb_build_object(
      'name', format('Bulk %s', series),
      'email', format('bulk-%s@example.com', series),
      'note', CASE WHEN series % 2 = 0 THEN 'Engineer' ELSE 'Designer' END,
      'score', series % 100,
      'attendees', (series % 4) + 1,
      'consent', series % 2 = 0,
      'department', CASE WHEN series % 2 = 0 THEN 'engineering' ELSE 'design' END,
      'skills', jsonb_build_array(CASE WHEN series % 2 = 0 THEN 'vue' ELSE 'figma' END),
      'regionPath', jsonb_build_array('cn', CASE WHEN series % 2 = 0 THEN 'shanghai' ELSE 'beijing' END),
      'sessions', jsonb_build_array(jsonb_build_object('topic', 'bulk')),
      'eventDate', to_char(date '2026-01-01' + (series % 365), 'YYYY-MM-DD'),
      'eventTime', to_char(time '08:00' + ((series % 600) * interval '1 minute'), 'HH24:MI:SS'),
      'startsAt', (timestamptz '2026-01-01T00:00:00Z' + (series * interval '1 minute'))::text
    ),
    jsonb_build_object('reviewStatus', 'pending'),
    timestamptz '2026-01-01T00:00:00Z' + (series * interval '1 minute')
  FROM generate_series(1, 10000) AS series
`;

describe('PostgreSQL JSONB table-query spike', () => {
  it('keeps queries scoped and uses the baseline indexes', async () => {
    const prisma = new PrismaClient();

    try {
      await prisma.$transaction(async (transaction) => {
        await transaction.$executeRawUnsafe(CREATE_TABLE_SQL);
        await transaction.$executeRawUnsafe(INSERT_FIXED_ROWS_SQL);
        await transaction.$executeRawUnsafe(INSERT_PLAN_ROWS_SQL);
        await transaction.$executeRawUnsafe(`
          CREATE INDEX submission_query_spike_public_gin_idx
          ON submission_query_spike USING gin (public_data jsonb_path_ops)
        `);
        await transaction.$executeRawUnsafe(`
          CREATE INDEX submission_query_spike_internal_gin_idx
          ON submission_query_spike USING gin (internal_data jsonb_path_ops)
        `);
        await transaction.$executeRawUnsafe(`
          CREATE INDEX submission_query_spike_workspace_submitted_idx
          ON submission_query_spike (workspace_id, submitted_at DESC, id DESC)
        `);
        await transaction.$executeRawUnsafe(`
          CREATE INDEX submission_query_spike_department_score_idx
          ON submission_query_spike (
            workspace_id,
            (public_data ->> 'department'),
            ((public_data ->> 'score')::numeric) DESC,
            id
          )
        `);
        await transaction.$executeRawUnsafe('ANALYZE submission_query_spike');

        const primitiveRows = await transaction.$queryRawUnsafe<IdRow[]>(`
          SELECT id::text AS id
          FROM submission_query_spike
          WHERE workspace_id = 'workspace-a'
            AND public_data ->> 'name' = 'Alice'
            AND public_data ->> 'email' = 'alice@example.com'
            AND public_data ->> 'note' ILIKE '%engineer%'
            AND (public_data ->> 'score')::numeric = 92.5
            AND (public_data ->> 'attendees')::integer = 2
            AND (public_data ->> 'consent')::boolean IS TRUE
            AND public_data ->> 'department' = 'engineering'
            AND public_data @> '{"skills":["typescript"]}'::jsonb
            AND public_data @> '{"regionPath":["cn","shanghai"]}'::jsonb
            AND public_data @> '{"sessions":[{"topic":"orientation"}]}'::jsonb
            AND (public_data ->> 'eventDate')::date = date '2026-07-18'
            AND (public_data ->> 'eventTime')::time = time '09:30:00'
            AND (public_data ->> 'startsAt')::timestamptz
              = timestamptz '2026-07-18T01:30:00Z'
            AND internal_data @> '{"reviewStatus":"priority"}'::jsonb
        `);
        expect(primitiveRows).toEqual([{ id: '1' }]);

        const allRows = await transaction.$queryRawUnsafe<IdRow[]>(`
          SELECT id::text AS id
          FROM submission_query_spike
          WHERE workspace_id = 'workspace-a'
            AND id <= 4
            AND public_data ->> 'department' = 'engineering'
            AND (public_data ->> 'score')::numeric >= 90
          ORDER BY id
        `);
        expect(allRows).toEqual([{ id: '1' }, { id: '3' }]);

        const anyRows = await transaction.$queryRawUnsafe<IdRow[]>(`
          SELECT id::text AS id
          FROM submission_query_spike
          WHERE workspace_id = 'workspace-a'
            AND id <= 4
            AND (
              public_data ->> 'name' = 'Alice'
              OR public_data @> '{"skills":["typescript"]}'::jsonb
            )
          ORDER BY id
        `);
        expect(anyRows).toEqual([{ id: '1' }]);

        const sortedRows = await transaction.$queryRawUnsafe<IdRow[]>(`
          SELECT id::text AS id
          FROM submission_query_spike
          WHERE workspace_id = 'workspace-a' AND id <= 3
          ORDER BY
            public_data ->> 'department' ASC,
            (public_data ->> 'score')::numeric DESC,
            id ASC
        `);
        expect(sortedRows).toEqual([{ id: '2' }, { id: '1' }, { id: '3' }]);

        const scopedRows = await transaction.$queryRawUnsafe<IdRow[]>(`
          SELECT id::text AS id
          FROM submission_query_spike
          WHERE workspace_id = 'workspace-a'
            AND public_data ->> 'name' = 'Alice'
        `);
        expect(scopedRows).toEqual([{ id: '1' }]);

        await transaction.$executeRawUnsafe('SET LOCAL enable_seqscan = off');
        const ginPlan = await transaction.$queryRawUnsafe<ExplainRow[]>(`
          EXPLAIN (FORMAT JSON)
          SELECT id
          FROM submission_query_spike
          WHERE workspace_id = 'workspace-a'
            AND public_data @> '{"skills":["typescript"]}'::jsonb
        `);
        const sortPlan = await transaction.$queryRawUnsafe<ExplainRow[]>(`
          EXPLAIN (FORMAT JSON)
          SELECT id
          FROM submission_query_spike
          WHERE workspace_id = 'workspace-a'
          ORDER BY
            public_data ->> 'department' ASC,
            (public_data ->> 'score')::numeric DESC,
            id ASC
          LIMIT 50
        `);
        const internalPlan = await transaction.$queryRawUnsafe<ExplainRow[]>(`
          EXPLAIN (FORMAT JSON)
          SELECT id
          FROM submission_query_spike
          WHERE workspace_id = 'workspace-a'
            AND internal_data @> '{"reviewStatus":"priority"}'::jsonb
        `);
        const submittedPlan = await transaction.$queryRawUnsafe<ExplainRow[]>(`
          EXPLAIN (FORMAT JSON)
          SELECT id
          FROM submission_query_spike
          WHERE workspace_id = 'workspace-a'
          ORDER BY submitted_at DESC, id DESC
          LIMIT 50
        `);

        expect(JSON.stringify(ginPlan[0]?.['QUERY PLAN']))
          .toContain('submission_query_spike_public_gin_idx');
        expect(JSON.stringify(sortPlan[0]?.['QUERY PLAN']))
          .toContain('submission_query_spike_department_score_idx');
        expect(JSON.stringify(internalPlan[0]?.['QUERY PLAN']))
          .toContain('submission_query_spike_internal_gin_idx');
        expect(JSON.stringify(submittedPlan[0]?.['QUERY PLAN']))
          .toContain('submission_query_spike_workspace_submitted_idx');
      }, { timeout: 60_000 });
    } finally {
      await prisma.$disconnect();
    }
  }, 70_000);
});
