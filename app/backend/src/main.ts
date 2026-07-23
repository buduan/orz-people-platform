import { bootstrapHttp } from './bootstrap/http';
import { JsonLogger } from './observability/json-logger.service';

const logger = new JsonLogger();

bootstrapHttp().catch((error: unknown) => {
  logger.error('HTTP process failed to start.', error);
  // Exit explicitly: open handles (Redis, Prisma) would otherwise keep a
  // failed process alive as a zombie under `nest start --watch`.
  process.exit(1);
});
