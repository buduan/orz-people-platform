import { Body, Controller, Post } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { passkey } from '@better-auth/passkey';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins';
import request from 'supertest';
import {
  afterEach, describe, expect, it,
} from 'vitest';

import { mountBetterAuthHandler } from '../../src/auth/mount-better-auth-handler';

@Controller('business')
class BusinessController {
  @Post('echo')
  public echo(@Body() body: unknown): unknown {
    return body;
  }
}

const ORIGIN = 'http://localhost';

interface TestApp {
  app: INestApplication;
  sentOtps: Map<string, string>;
}

async function createApp(): Promise<TestApp> {
  const sentOtps = new Map<string, string>();
  const auth = betterAuth({
    advanced: {
      disableCSRFCheck: false,
      disableOriginCheck: false,
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
    },
    appName: 'Orz People Platform auth mount test',
    baseURL: ORIGIN,
    database: memoryAdapter({
      account: [],
      passkey: [],
      session: [],
      user: [],
      verification: [],
    }),
    emailAndPassword: { enabled: true },
    plugins: [
      emailOTP({
        allowedAttempts: 3,
        expiresIn: 300,
        generateOTP: () => '123456',
        sendVerificationOTP: async ({ email, otp }) => {
          sentOtps.set(email, otp);
        },
        storeOTP: 'hashed',
      }),
      passkey({ origin: ORIGIN, rpID: 'localhost', rpName: 'Orz People Platform' }),
    ],
    secret: 'test-secret-with-at-least-32-characters',
    telemetry: { enabled: false },
    trustedOrigins: [ORIGIN],
  });

  const module = await Test.createTestingModule({
    controllers: [BusinessController],
  }).compile();
  const app = module.createNestApplication<NestExpressApplication>({ bodyParser: false });

  // Cast mirrors mount-better-auth-handler's structural expectation; the real
  // Better Auth instance exposes the same web `handler`.
  const handler = auth as unknown as Parameters<typeof mountBetterAuthHandler>[1];
  await mountBetterAuthHandler(app, handler);
  await app.init();

  return { app, sentOtps };
}

describe('Better Auth handler mounted in the Nest HTTP pipeline', () => {
  let current: INestApplication | undefined;

  afterEach(async () => {
    await current?.close();
    current = undefined;
  });

  it('leaves the auth request stream unparsed while business routes still parse JSON', async () => {
    const { app, sentOtps } = await createApp();
    current = app;

    // Auth route: Better Auth consumes the raw body and produces its own result.
    const authResponse = await request(app.getHttpServer())
      .post('/api/auth/email-otp/send-verification-otp')
      .set('Origin', ORIGIN)
      .set('X-Forwarded-For', '198.51.100.10')
      .send({ email: 'user@example.com', type: 'sign-in' });
    // Business route: Nest body parser is re-enabled after the auth handler.
    const businessResponse = await request(app.getHttpServer())
      .post('/business/echo')
      .send({ value: 'parsed-by-nest' });

    expect(authResponse.status).toBe(200);
    expect(sentOtps.get('user@example.com')).toBe('123456');
    expect(businessResponse.status).toBe(201);
    expect(businessResponse.body).toEqual({ value: 'parsed-by-nest' });
  });

  it('rejects a cross-site origin on a state-changing auth request (CSRF/trusted origin)', async () => {
    const { app, sentOtps } = await createApp();
    current = app;

    // Establish a real session so sign-out is genuinely state-changing.
    const email = 'csrf@example.com';
    await request(app.getHttpServer())
      .post('/api/auth/email-otp/send-verification-otp')
      .set('Origin', ORIGIN)
      .set('X-Forwarded-For', '198.51.100.30')
      .send({ email, type: 'sign-in' });
    const signIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email-otp')
      .set('Origin', ORIGIN)
      .set('X-Forwarded-For', '198.51.100.30')
      .send({ email, name: 'CSRF User', otp: sentOtps.get(email) });
    const setCookie = signIn.headers['set-cookie'] as string[] | undefined;
    const sessionCookie = setCookie?.[0]?.split(';')[0];

    expect(signIn.status).toBe(200);
    expect(sessionCookie).toBeDefined();

    const untrusted = await request(app.getHttpServer())
      .post('/api/auth/sign-out')
      .set('Cookie', sessionCookie as string)
      .set('Origin', 'https://evil.example')
      .set('X-Forwarded-For', '198.51.100.31');

    expect(untrusted.status).toBe(403);
  });

  it('uses the configured proxy header for rate-limit client identity', async () => {
    const { app } = await createApp();
    current = app;

    // Two different forwarded IPs on the OTP send route; both accepted because
    // the proxy header (not a spoofable client header) determines identity.
    const first = await request(app.getHttpServer())
      .post('/api/auth/email-otp/send-verification-otp')
      .set('Origin', ORIGIN)
      .set('X-Forwarded-For', '198.51.100.20')
      .send({ email: 'a@example.com', type: 'sign-in' });
    const second = await request(app.getHttpServer())
      .post('/api/auth/email-otp/send-verification-otp')
      .set('Origin', ORIGIN)
      .set('X-Forwarded-For', '198.51.100.21')
      .send({ email: 'b@example.com', type: 'sign-in' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });
});
