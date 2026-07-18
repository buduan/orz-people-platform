import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  createWorkerHealthServer,
  type WorkerHealthServer,
} from '../../src/worker/worker-health-server';

let health: WorkerHealthServer | undefined;

afterEach(async () => {
  await health?.close();
  health = undefined;
});

describe('worker process health server', () => {
  it('reports liveness and withdraws readiness before shutdown', async () => {
    health = await createWorkerHealthServer(0);
    const baseUrl = `http://127.0.0.1:${health.port}`;

    const live = await fetch(`${baseUrl}/health/live`);
    const ready = await fetch(`${baseUrl}/health/ready`);

    expect(live.status).toBe(200);
    expect(ready.status).toBe(200);

    health.markNotReady();
    const shuttingDown = await fetch(`${baseUrl}/health/ready`);

    expect(shuttingDown.status).toBe(503);
  });
});
