import { randomUUID } from 'node:crypto';

import {
  Queue,
  QueueEvents,
  Worker,
  type ConnectionOptions,
  type Job,
} from 'bullmq';
import { describe, expect, it } from 'vitest';

interface DeliveryJob {
  eventId: string;
  failOnce?: boolean;
}

interface DeliveryResult {
  eventId: string;
  type: string;
}

function connectionOptions(redisUrl: string, worker: boolean): ConnectionOptions {
  const url = new URL(redisUrl);

  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error('BullMQ spike requires a redis:// or rediss:// URL.');
  }

  const database = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0;

  return {
    db: Number.isInteger(database) ? database : 0,
    enableOfflineQueue: worker,
    host: url.hostname,
    maxRetriesPerRequest: worker ? null : 1,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    port: url.port ? Number(url.port) : 6379,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    username: url.username ? decodeURIComponent(url.username) : undefined,
  };
}

describe('BullMQ Worker topology spike', () => {
  it('processes destinations independently, retries, deduplicates, and closes cleanly', async () => {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error('REDIS_URL is required for the BullMQ spike.');
    }

    const queueName = `delivery-spike-${randomUUID()}`;
    const producerConnection = connectionOptions(redisUrl, false);
    const workerConnection = connectionOptions(redisUrl, true);
    const queue = new Queue<DeliveryJob, DeliveryResult>(queueName, {
      connection: producerConnection,
    });
    const events = new QueueEvents(queueName, { connection: workerConnection });
    const attempts = new Map<string, number>();
    const workerErrors: Error[] = [];
    const worker = new Worker<DeliveryJob, DeliveryResult>(
      queueName,
      async (job: Job<DeliveryJob>) => {
        const count = (attempts.get(job.id ?? '') ?? 0) + 1;
        attempts.set(job.id ?? '', count);

        if (job.data.failOnce && count === 1) {
          throw new Error('Simulated transient delivery failure.');
        }

        return {
          eventId: job.data.eventId,
          type: job.name,
        };
      },
      { connection: workerConnection },
    );
    worker.on('error', (error) => workerErrors.push(error));

    try {
      await Promise.all([
        queue.waitUntilReady(),
        events.waitUntilReady(),
        worker.waitUntilReady(),
      ]);
      const webhook = await queue.add('webhook', {
        eventId: 'event-1',
        failOnce: true,
      }, {
        attempts: 2,
        backoff: { delay: 10, type: 'fixed' },
        jobId: 'event-1-webhook-a',
      });
      const email = await queue.add('email', { eventId: 'event-1' }, {
        jobId: 'event-1-email-a',
      });
      const [webhookResult, emailResult] = await Promise.all([
        webhook.waitUntilFinished(events, 10_000),
        email.waitUntilFinished(events, 10_000),
      ]);
      const duplicate = await queue.add('webhook', {
        eventId: 'event-1',
        failOnce: true,
      }, {
        jobId: 'event-1-webhook-a',
      });

      expect(webhookResult).toEqual({ eventId: 'event-1', type: 'webhook' });
      expect(emailResult).toEqual({ eventId: 'event-1', type: 'email' });
      expect(attempts.get('event-1-webhook-a')).toBe(2);
      expect(attempts.get('event-1-email-a')).toBe(1);
      expect(duplicate.id).toBe(webhook.id);
      expect(workerErrors).toEqual([]);
    } finally {
      await worker.close();
      await queue.obliterate({ force: true });
      await events.close();
      await queue.close();
    }
  }, 30_000);
});
