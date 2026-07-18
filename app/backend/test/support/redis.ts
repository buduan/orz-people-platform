import { randomUUID } from 'node:crypto';

import Redis from 'ioredis';

export interface TestRedis {
  cleanup: () => Promise<void>;
  client: Redis;
  prefix: string;
}

async function deletePrefix(client: Redis, prefix: string, cursor = '0'): Promise<void> {
  const [nextCursor, keys] = await client.scan(
    cursor,
    'MATCH',
    `${prefix}*`,
    'COUNT',
    100,
  );

  if (keys.length > 0) {
    await client.unlink(...keys);
  }

  if (nextCursor !== '0') {
    await deletePrefix(client, prefix, nextCursor);
  }
}

export async function createTestRedis(): Promise<TestRedis> {
  const redisUrl = process.env.TEST_REDIS_URL ?? process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error('TEST_REDIS_URL or REDIS_URL is required.');
  }

  const client = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  const prefix = `orz:test:${randomUUID()}:`;

  await client.connect();

  return {
    client,
    prefix,
    cleanup: async () => {
      await deletePrefix(client, prefix);
      await client.quit();
    },
  };
}
