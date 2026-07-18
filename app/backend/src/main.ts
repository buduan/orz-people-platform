import { bootstrapHttp } from './bootstrap/http';
import { JsonLogger } from './observability/json-logger.service';

const logger = new JsonLogger();

bootstrapHttp().catch((error: unknown) => {
  logger.error('HTTP process failed to start.', error);
  process.exitCode = 1;
});
