import type { IncomingMessage, ServerResponse } from 'node:http';

import type { NestExpressApplication } from '@nestjs/platform-express';

type BetterAuthWebHandler = (request: Request) => Promise<Response>;
type BetterAuthHandler = BetterAuthWebHandler | { handler: BetterAuthWebHandler };
type ExpressApplication = {
  all: (
    path: string,
    handler: (request: IncomingMessage, response: ServerResponse) => Promise<void>,
  ) => void;
};

export async function mountBetterAuthHandler(
  app: NestExpressApplication,
  auth: BetterAuthHandler,
): Promise<void> {
  const { toNodeHandler } = await import('better-auth/node');
  const express = app.getHttpAdapter().getInstance() as ExpressApplication;

  express.all('/api/auth/*splat', toNodeHandler(auth));
  app.useBodyParser('json');
  app.useBodyParser('urlencoded', { extended: true });
}
