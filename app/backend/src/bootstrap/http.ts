import type { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { AppModule } from '../app.module';
import { AuthService } from '../auth/auth.service';
import type { Environment } from '../config/environment';
import { mountBetterAuthHandler } from '../auth/mount-better-auth-handler';
import { JsonLogger } from '../observability/json-logger.service';
import { mountOpenApi } from '../openapi/openapi';

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

function createCorsOriginValidator(config: ConfigService<Environment, true>) {
  const allowedOrigins = new Set<string>([
    config.getOrThrow('APP_ORIGIN'),
    ...config.getOrThrow<string[]>('CORS_ALLOWED_ORIGINS'),
  ]);

  return (requestOrigin: string | undefined): boolean => {
    if (requestOrigin === undefined) {
      return false;
    }

    if (allowedOrigins.has(requestOrigin)) {
      return true;
    }

    if (config.get('NODE_ENV') === 'development') {
      try {
        const parsed = new URL(requestOrigin);

        return parsed.protocol === 'http:' && LOCALHOST_HOSTNAMES.has(parsed.hostname);
      } catch {
        return false;
      }
    }

    return false;
  };
}

export async function createHttpApplication(): Promise<NestExpressApplication> {
  const logger = new JsonLogger();
  // Better Auth reads the raw request stream, so Nest must not body-parse before
  // the auth handler mounts. mountBetterAuthHandler re-enables body parsing for
  // business routes after installing the auth handler.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    logger,
  });
  const config = app.get(ConfigService);
  const isCorsOriginAllowed = createCorsOriginValidator(config);

  app.enableCors({
    credentials: true,
    origin: (requestOrigin, callback) => callback(null, isCorsOriginAllowed(requestOrigin)),
  });

  // Build the Better Auth instance eagerly (onModuleInit has not run yet at this
  // point) and mount its raw Express handler before app.init()/listen() so the
  // /api/auth routes are registered ahead of Nest's terminal not-found handler.
  const authService = app.get(AuthService);
  await authService.ensureInitialized();
  await mountBetterAuthHandler(app, authService.instance);

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
