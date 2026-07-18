import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

export interface TestPostgres {
  cleanup: () => Promise<void>;
  client: PrismaClient;
  schema: string;
}

function quotedIdentifier(identifier: string): string {
  if (!/^[a-z][a-z0-9_]+$/u.test(identifier)) {
    throw new Error('Unsafe PostgreSQL identifier.');
  }

  return `"${identifier}"`;
}

export async function createTestPostgres(): Promise<TestPostgres> {
  const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL or DATABASE_URL is required.');
  }

  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  const identifier = quotedIdentifier(schema);
  const schemaUrl = new URL(databaseUrl);
  const admin = new PrismaClient({ datasourceUrl: databaseUrl });

  schemaUrl.searchParams.set('schema', schema);
  await admin.$executeRawUnsafe(`CREATE SCHEMA ${identifier}`);

  const client = new PrismaClient({ datasourceUrl: schemaUrl.toString() });
  await client.$connect();
  let cleaned = false;

  return {
    client,
    schema,
    cleanup: async () => {
      if (cleaned) {
        return;
      }

      cleaned = true;
      await client.$disconnect();
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${identifier} CASCADE`);
      await admin.$disconnect();
    },
  };
}
