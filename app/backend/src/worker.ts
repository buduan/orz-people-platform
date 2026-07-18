import { bootstrapWorker } from './bootstrap/worker';
import { JsonLogger } from './observability/json-logger.service';

const logger = new JsonLogger();

bootstrapWorker().catch((error: unknown) => {
  logger.error('Worker process failed to start.', error);
  process.exitCode = 1;
});
