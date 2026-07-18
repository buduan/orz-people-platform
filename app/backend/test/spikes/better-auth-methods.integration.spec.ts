import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { passkey } from '@better-auth/passkey';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { betterAuth } from 'better-auth/minimal';
import { emailOTP } from 'better-auth/plugins';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { mountBetterAuthHandler } from '../../src/auth/mount-better-auth-handler';

class TestSecondaryStorage {
  public incrementCalls = 0;

  private readonly values = new Map<string, string>();

  public async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  public async getAndDelete(key: string): Promise<string | null> {
    const value = this.values.get(key) ?? null;

    this.values.delete(key);

    return value;
  }

  public async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  public async delete(key: string): Promise<void> {
    this.values.delete(key);
  }

  public async increment(key: string): Promise<number> {
    this.incrementCalls += 1;
    const value = Number(this.values.get(key) ?? '0') + 1;

    this.values.set(key, String(value));

    return value;
  }
}

function getCookie(response: request.Response): string {
  const setCookie = response.headers['set-cookie'] as string[] | undefined;

  if (!setCookie?.[0]) {
    throw new Error('Expected Better Auth to set a session cookie.');
  }

  return setCookie[0].split(';')[0];
}

describe('Better Auth authentication method spike', () => {
  it('supports OTP-only and password users, passkey options, trusted origins, and rate limits', async () => {
    const sentOtps = new Map<string, string>();
    const secondaryStorage = new TestSecondaryStorage();
    const auth = betterAuth({
      advanced: {
        disableCSRFCheck: false,
        disableOriginCheck: false,
        ipAddress: {
          ipAddressHeaders: ['x-real-ip'],
        },
      },
      appName: 'Orz People Platform auth methods spike',
      baseURL: 'http://localhost',
      database: memoryAdapter({
        account: [],
        passkey: [],
        session: [],
        user: [],
        verification: [],
      }),
      emailAndPassword: {
        enabled: true,
      },
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
        passkey({
          origin: 'http://localhost',
          rpID: 'localhost',
          rpName: 'Orz People Platform',
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
        max: 100,
        storage: 'secondary-storage',
        window: 60,
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

    await mountBetterAuthHandler(app, auth);
    await app.init();

    const otpEmail = 'otp-user@example.com';
    const sendOtp = await request(app.getHttpServer())
      .post('/api/auth/email-otp/send-verification-otp')
      .set('Origin', 'http://localhost')
      .set('X-Real-Ip', '198.51.100.10')
      .send({ email: otpEmail, type: 'sign-in' });
    const rateLimited = await request(app.getHttpServer())
      .post('/api/auth/email-otp/send-verification-otp')
      .set('Origin', 'http://localhost')
      .set('X-Real-Ip', '198.51.100.10')
      .send({ email: otpEmail, type: 'sign-in' });
    expect(sendOtp.status).toBe(200);
    expect(sentOtps.get(otpEmail)).toBe('123456');
    expect(rateLimited.status).toBe(429);
    expect(secondaryStorage.incrementCalls).toBeGreaterThan(0);

    const otpSignIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email-otp')
      .set('Origin', 'http://localhost')
      .set('X-Real-Ip', '198.51.100.12')
      .send({ email: otpEmail, name: 'OTP User', otp: sentOtps.get(otpEmail) });

    expect(otpSignIn.status).toBe(200);
    expect(otpSignIn.body.user.email).toBe(otpEmail);
    const otpSessionCookie = getCookie(otpSignIn);

    const untrustedOrigin = await request(app.getHttpServer())
      .post('/api/auth/sign-out')
      .set('Cookie', otpSessionCookie)
      .set('Origin', 'https://evil.example')
      .set('X-Real-Ip', '198.51.100.11');

    const session = await request(app.getHttpServer())
      .get('/api/auth/get-session')
      .set('Cookie', otpSessionCookie);
    const passkeyOptions = await request(app.getHttpServer())
      .get('/api/auth/passkey/generate-register-options')
      .set('Cookie', otpSessionCookie)
      .set('Origin', 'http://localhost');

    expect(untrustedOrigin.status).toBe(403);
    expect(session.status).toBe(200);
    expect(session.body.user.email).toBe(otpEmail);
    expect(passkeyOptions.status).toBe(200);
    expect(passkeyOptions.body.challenge).toEqual(expect.any(String));
    expect(passkeyOptions.body.rp).toEqual({
      id: 'localhost',
      name: 'Orz People Platform',
    });

    const passwordEmail = 'password-user@example.com';
    const passwordSignUp = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost')
      .set('X-Real-Ip', '198.51.100.13')
      .send({
        email: passwordEmail,
        name: 'Password User',
        password: 'correct-horse-battery-staple',
      });
    const passwordSignIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .set('Origin', 'http://localhost')
      .set('X-Real-Ip', '198.51.100.14')
      .send({
        email: passwordEmail,
        password: 'correct-horse-battery-staple',
      });

    expect(passwordSignUp.status).toBe(200);
    expect(passwordSignIn.status).toBe(200);
    expect(passwordSignIn.body.user.email).toBe(passwordEmail);

    await app.close();
  });
});
