import type { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { AppModule } from '../app.module';
import { AuthService } from '../auth/auth.service';
import { mountBetterAuthHandler } from '../auth/mount-better-auth-handler';
import { JsonLogger } from '../observability/json-logger.service';
import { mountOpenApi } from '../openapi/openapi';

export async function createHttpApplication(): Promise<NestExpressApplication> {
  const logger = new JsonLogger();
  // Better Auth reads the raw request stream, so Nest must not body-parse before
  // the auth handler mounts. mountBetterAuthHandler re-enables body parsing for
  // business routes after installing the auth handler.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    logger,
  });

  await mountBetterAuthHandler(app, app.get(AuthService).instance);

  mountOpenApi(app);
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);

  return app;
}

export async function bootstrapHttp(): Promise<NestExpressApplication> {
  const app = await createHttpApplication();
  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('PORT');

  await app.listen(port);
  app.get(JsonLogger).log('HTTP process started.', {
    docsUrl: `http://localhost:${port}/docs`,
    port,
  });

  return app;
}
