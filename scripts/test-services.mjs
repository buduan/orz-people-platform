import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');

export function runTestServices(command) {
  const composeArguments = ['compose', '-f', 'compose.test.yml'];

  if (command === 'up') {
    composeArguments.push('up', '-d', '--wait');
  } else if (command === 'down') {
    composeArguments.push('down', '--volumes', '--remove-orphans');
  } else if (command === 'status') {
    composeArguments.push('ps');
  } else {
    throw new Error(`Unknown test services command: ${command}`);
  }

  return new Promise((resolveRun, reject) => {
    const child = spawn('docker', composeArguments, {
      cwd: repositoryRoot,
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }

      reject(new Error(`docker compose exited with code ${code ?? 'unknown'}.`));
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runTestServices(process.argv[2] ?? 'status');
}
