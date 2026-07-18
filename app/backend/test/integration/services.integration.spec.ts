import { PrismaClient } from '@prisma/client';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import { createTestPostgres, type TestPostgres } from '../support/postgresql';
import { createTestRedis, type TestRedis } from '../support/redis';

interface CountRow {
  count: bigint;
}

let postgres: TestPostgres | undefined;
let redis: TestRedis | undefined;

afterEach(async () => {
  await Promise.all([
    postgres?.cleanup(),
    redis?.cleanup(),
  ]);
  postgres = undefined;
  redis = undefined;
});

describe('isolated integration services', () => {
  it('creates and drops an isolated PostgreSQL schema', async () => {
    postgres = await createTestPostgres();
    const { schema } = postgres;

    await postgres.client.$executeRawUnsafe('CREATE TABLE baseline (id integer PRIMARY KEY)');
    await postgres.client.$executeRawUnsafe('INSERT INTO baseline (id) VALUES (1)');

    const count = await postgres.client.$queryRawUnsafe<CountRow[]>(
      'SELECT COUNT(*) AS count FROM baseline',
    );
    expect(count[0]?.count).toBe(1n);

    await postgres.cleanup();
    postgres = undefined;

    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
    const admin = new PrismaClient({ datasourceUrl: databaseUrl });
    const schemas = await admin.$queryRaw<Array<{ schemaName: string }>>`
      SELECT schema_name AS "schemaName"
      FROM information_schema.schemata
      WHERE schema_name = ${schema}
    `;

    expect(schemas).toEqual([]);
    await admin.$disconnect();
  });

  it('cleans only keys in its isolated Redis namespace', async () => {
    redis = await createTestRedis();
    const key = `${redis.prefix}baseline`;

    await redis.client.set(key, 'ready');
    expect(await redis.client.get(key)).toBe('ready');

    await redis.cleanup();
    redis = undefined;

    const verification = await createTestRedis();
    expect(await verification.client.get(key)).toBeNull();
    await verification.cleanup();
  });
});
