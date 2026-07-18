import type { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { AppModule } from '../app.module';
import { JsonLogger } from '../observability/json-logger.service';
import { mountOpenApi } from '../openapi/openapi';

export async function createHttpApplication(): Promise<NestExpressApplication> {
  const logger = new JsonLogger();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger });

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
