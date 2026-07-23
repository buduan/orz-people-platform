import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';

import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

const BACKEND_ROOT = resolve(import.meta.dirname, '../..');
const MASTER_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const processes = new Set<ChildProcess>();

interface ProcessExit {
  code: number | null;
  signal: NodeJS.Signals | null;
}

function processEnvironment(port: number, workerHealthPort: number): NodeJS.ProcessEnv {
  return {
    ...process.env,
    API_ORIGIN: `http://localhost:${port}`,
    APP_ORIGIN: 'http://localhost:3001',
    BETTER_AUTH_SECRET: 'integration-secret-with-at-least-32-characters',
    CORS_ALLOWED_ORIGINS: '',
    DATABASE_URL: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
    MASTER_ENCRYPTION_KEY: MASTER_KEY,
    NODE_ENV: 'test',
    PASSKEY_ORIGIN: 'http://localhost:3001',
    PASSKEY_RP_ID: 'localhost',
    PORT: String(port),
    REDIS_URL: process.env.TEST_REDIS_URL ?? process.env.REDIS_URL,
    WORKER_HEALTH_PORT: String(workerHealthPort),
  };
}

function start(entry: 'main.js' | 'worker.js', port: number, workerHealthPort: number): ChildProcess {
  const child = spawn(process.execPath, [resolve(BACKEND_ROOT, 'dist', entry)], {
    cwd: BACKEND_ROOT,
    env: processEnvironment(port, workerHealthPort),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  processes.add(child);
  return child;
}

async function waitForHealth(url: string, attempts = 100): Promise<Response> {
  try {
    const response = await fetch(url);

    if (response.ok) {
      return response;
    }
  } catch {
    // The process can still be starting.
  }

  if (attempts <= 1) {
    throw new Error(`Process did not become healthy at ${url}.`);
  }

  await new Promise((resolveWait) => {
    setTimeout(resolveWait, 50);
  });
  return waitForHealth(url, attempts - 1);
}

function waitForExit(child: ChildProcess): Promise<ProcessExit> {
  return new Promise((resolveExit, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Process did not exit after SIGTERM.'));
    }, 5_000);

    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      processes.delete(child);
      resolveExit({ code, signal });
    });
  });
}

async function terminate(child: ChildProcess): Promise<ProcessExit> {
  const exit = waitForExit(child);

  child.kill('SIGTERM');
  return exit;
}

afterEach(async () => {
  await Promise.all([...processes].map(async (child) => {
    if (child.exitCode === null && child.signalCode === null) {
      await terminate(child);
    }
  }));
});

describe('independent process entries', () => {
  it('starts and gracefully stops the HTTP process', async () => {
    const child = start('main.js', 33_10, 33_12);
    const health = await waitForHealth('http://127.0.0.1:3310/health/ready');

    expect((await health.json()).data.status).toBe('ready');
    const exit = await terminate(child);
    expect(exit.code === 0 || exit.signal === 'SIGTERM').toBe(true);
  });

  it('starts and gracefully stops the Worker process', async () => {
    const child = start('worker.js', 33_11, 33_12);
    const health = await waitForHealth('http://127.0.0.1:3312/health/ready');

    expect((await health.json()).status).toBe('ok');
    const exit = await terminate(child);
    expect(exit.code).toBe(0);
  });
});
