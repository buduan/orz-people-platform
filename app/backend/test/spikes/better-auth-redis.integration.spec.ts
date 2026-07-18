import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { betterAuth } from 'better-auth/minimal';
import { emailOTP } from 'better-auth/plugins';
import Redis from 'ioredis';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createBetterAuthSecondaryStorage } from '../../src/auth/better-auth-secondary-storage';
import { mountBetterAuthHandler } from '../../src/auth/mount-better-auth-handler';

describe('Better Auth Redis rate-limit spike', () => {
  it('stores atomic rate-limit counters in Redis secondary storage', async () => {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error('REDIS_URL is required for the Redis spike.');
    }

    const redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    const keyPrefix = `orz:auth-spike:${randomUUID()}:`;
    const secondaryStorage = createBetterAuthSecondaryStorage(redis, keyPrefix);
    const auth = betterAuth({
      advanced: {
        disableCSRFCheck: false,
        disableOriginCheck: false,
      },
      baseURL: 'http://localhost',
      database: memoryAdapter({
        account: [],
        session: [],
        user: [],
        verification: [],
      }),
      plugins: [
        emailOTP({
          generateOTP: () => '123456',
          sendVerificationOTP: async () => {},
          storeOTP: 'hashed',
        }),
      ],
      rateLimit: {
        customRules: {
          '/email-otp/send-verification-otp': {
            max: 1,
            window: 60,
          },
        },
        enabled: true,
        storage: 'secondary-storage',
      },
      secondaryStorage,
      secret: 'test-secret-with-at-least-32-characters',
      telemetry: { enabled: false },
      trustedOrigins: ['http://localhost'],
    });
    const module = await Test.createTestingModule({}).compile();
    const app = module.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });

    await redis.connect();
    await mountBetterAuthHandler(app, auth);
    await app.init();

    const first = await request(app.getHttpServer())
      .post('/api/auth/email-otp/send-verification-otp')
      .set('Origin', 'http://localhost')
      .send({ email: 'redis-rate-limit@example.com', type: 'sign-in' });
    const second = await request(app.getHttpServer())
      .post('/api/auth/email-otp/send-verification-otp')
      .set('Origin', 'http://localhost')
      .send({ email: 'redis-rate-limit@example.com', type: 'sign-in' });
    const storedKeys = await redis.keys(`${keyPrefix}*`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(storedKeys.length).toBeGreaterThan(0);

    if (storedKeys.length > 0) {
      await redis.del(...storedKeys);
    }
    await app.close();
    await redis.quit();
  });
});
