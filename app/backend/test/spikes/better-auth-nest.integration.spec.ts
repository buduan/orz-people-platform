import { Body, Controller, Post } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { betterAuth } from 'better-auth/minimal';
import request from 'supertest';
import {
  afterAll,
  describe,
  expect,
  it,
} from 'vitest';

import { mountBetterAuthHandler } from '../../src/auth/mount-better-auth-handler';

@Controller('spike')
class SpikeController {
  @Post('echo')
  public echo(@Body() body: unknown): unknown {
    return body;
  }
}

const prisma = new PrismaClient();

async function createApp(
  auth: Parameters<typeof mountBetterAuthHandler>[1],
): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    controllers: [SpikeController],
  }).compile();
  const app = module.createNestApplication<NestExpressApplication>({
    bodyParser: false,
  });

  await mountBetterAuthHandler(app, auth);
  await app.init();

  return app;
}

describe('Better Auth NestJS integration spike', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('mounts Better Auth with the Prisma adapter on Express 5', async () => {
    const auth = betterAuth({
      appName: 'Orz People Platform auth spike',
      baseURL: 'http://localhost',
      database: prismaAdapter(prisma, { provider: 'postgresql' }),
      secret: 'test-secret-with-at-least-32-characters',
      telemetry: { enabled: false },
    });
    const app = await createApp(auth);

    const response = await request(app.getHttpServer()).get('/api/auth/ok');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    await app.close();
  });

  it('leaves the auth request stream unread by Nest body parsing', async () => {
    const rawBodyAuth = async (webRequest: Request): Promise<Response> => Response.json({
      body: await webRequest.text(),
    });
    const app = await createApp(rawBodyAuth);

    const authResponse = await request(app.getHttpServer())
      .post('/api/auth/raw-body')
      .send({ value: 'available-to-better-auth' });
    const businessResponse = await request(app.getHttpServer())
      .post('/spike/echo')
      .send({ value: 'parsed-by-nest' });

    expect(authResponse.status).toBe(200);
    expect(JSON.parse(authResponse.body.body as string)).toEqual({
      value: 'available-to-better-auth',
    });
    expect(businessResponse.status).toBe(201);
    expect(businessResponse.body).toEqual({ value: 'parsed-by-nest' });
    await app.close();
  });
});
