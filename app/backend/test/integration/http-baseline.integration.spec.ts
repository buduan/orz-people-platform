import type { INestApplication } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

import { API_REQUEST_ID_HEADER } from '@orz-people-platform/types';

import { AppController } from '../../src/app.controller';
import { AppService } from '../../src/app.service';
import { HealthService } from '../../src/health/health.service';
import { ApiExceptionFilter } from '../../src/http/api-exception.filter';
import { ApiSuccessInterceptor } from '../../src/http/api-success.interceptor';
import { RequestContextMiddleware } from '../../src/http/request-context.middleware';
import { JsonLogger } from '../../src/observability/json-logger.service';

@Module({
  controllers: [AppController],
  providers: [
    AppService,
    HealthService,
    JsonLogger,
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiSuccessInterceptor,
    },
  ],
})
class TestHttpModule {}

describe('HTTP engineering baseline', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [TestHttpModule],
    }).compile();

    app = module.createNestApplication();
    const middleware = new RequestContextMiddleware();

    app.use(middleware.use.bind(middleware));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the success envelope and preserves a valid request ID', async () => {
    const response = await request(app.getHttpServer())
      .get('/health/ready')
      .set(API_REQUEST_ID_HEADER, 'baseline-request-1');

    expect(response.status, `${response.error} ${response.text}`).toBe(200);
    expect(response.headers[API_REQUEST_ID_HEADER]).toBe('baseline-request-1');
    expect(response.body).toMatchObject({
      data: {
        service: 'orz-people-platform-backend',
        status: 'ready',
      },
      meta: {
        requestId: 'baseline-request-1',
      },
    });
    expect(response.body.meta.timestamp).toEqual(expect.any(String));
  });

  it('returns the stable error envelope for an unknown route', async () => {
    const response = await request(app.getHttpServer()).get('/not-found');

    expect(response.status, `${response.error} ${response.text}`).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        code: 'HTTP_404',
      },
    });
    expect(response.body.meta.requestId).toEqual(expect.any(String));
  });

  it('replaces an invalid incoming request ID', async () => {
    const response = await request(app.getHttpServer())
      .get('/health/live')
      .set(API_REQUEST_ID_HEADER, 'contains spaces and should be replaced');

    expect(response.status).toBe(200);
    expect(response.headers[API_REQUEST_ID_HEADER]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(response.body.meta.requestId).toBe(response.headers[API_REQUEST_ID_HEADER]);
  });
});
