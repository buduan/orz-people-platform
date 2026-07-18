import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

import { runTestServices } from './test-services.mjs';

const repositoryRoot = resolve(import.meta.dirname, '..');
const testEnvironment = {
  ...process.env,
  DATABASE_URL: process.env.TEST_DATABASE_URL
    ?? 'postgresql://orz_test:orz_test@localhost:55432/orz_people_test?schema=public',
  REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://localhost:56379/0',
  TEST_DATABASE_URL: process.env.TEST_DATABASE_URL
    ?? 'postgresql://orz_test:orz_test@localhost:55432/orz_people_test?schema=public',
  TEST_REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://localhost:56379/0',
};

function runBackendScript(script) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(
      'pnpm',
      ['--filter', '@orz-people-platform/backend', script],
      {
        cwd: repositoryRoot,
        env: testEnvironment,
        stdio: 'inherit',
      },
    );

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }

      reject(new Error(`${script} exited with code ${code ?? 'unknown'}.`));
    });
  });
}

await runTestServices('up');

try {
  await runBackendScript('build');
  await runBackendScript('test:integration');
} finally {
  await runTestServices('down');
}
