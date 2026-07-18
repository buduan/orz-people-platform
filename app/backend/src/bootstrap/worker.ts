import type { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { JsonLogger } from '../observability/json-logger.service';
import { WorkerModule } from '../worker.module';
import {
  createWorkerHealthServer,
  type WorkerHealthServer,
} from '../worker/worker-health-server';

export interface WorkerProcess {
  app: INestApplicationContext;
  close: () => Promise<void>;
  health: WorkerHealthServer;
}

export async function bootstrapWorker(): Promise<WorkerProcess> {
  const logger = new JsonLogger();
  const app = await NestFactory.createApplicationContext(WorkerModule, { logger });
  const config = app.get(ConfigService);
  const healthPort = config.getOrThrow<number>('WORKER_HEALTH_PORT');
  const health = await createWorkerHealthServer(healthPort);
  let closing = false;

  const close = async (): Promise<void> => {
    if (closing) {
      return;
    }

    closing = true;
    health.markNotReady();
    await health.close();
    await app.close();
  };

  (['SIGINT', 'SIGTERM'] as const).forEach((signal) => {
    process.once(signal, () => {
      close().catch((error: unknown) => {
        logger.error('Worker process failed to stop cleanly.', error);
        process.exitCode = 1;
      });
    });
  });

  logger.log('Worker process started.', { healthPort });

  return { app, close, health };
}
