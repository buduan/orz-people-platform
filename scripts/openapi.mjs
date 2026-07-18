import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const repositoryRoot = resolve(import.meta.dirname, '..');
const schemaOutput = resolve(repositoryRoot, 'openapi/openapi.json');
const typeOutput = resolve(repositoryRoot, 'app/frontend/types/api.generated.d.ts');

function run(command, argumentsList) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, argumentsList, {
      cwd: repositoryRoot,
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? 'unknown'}.`));
    });
  });
}

async function generate(schemaPath, typesPath) {
  await run('pnpm', [
    '--filter',
    '@orz-people-platform/backend',
    'run',
    'openapi:document',
    '--',
    schemaPath,
  ]);
  await run('pnpm', [
    '--filter',
    '@orz-people-platform/frontend',
    'exec',
    'openapi-typescript',
    schemaPath,
    '--output',
    typesPath,
    '--export-type',
    '--immutable',
  ]);
}

async function assertSame(expectedPath, actualPath, label) {
  const [expected, actual] = await Promise.all([
    readFile(expectedPath, 'utf8'),
    readFile(actualPath, 'utf8'),
  ]);

  if (expected !== actual) {
    throw new Error(`${label} drift detected. Run pnpm openapi:generate.`);
  }
}

async function check() {
  const temporaryDirectory = await mkdtemp(resolve(tmpdir(), 'orz-openapi-'));

  try {
    const temporarySchema = resolve(temporaryDirectory, 'openapi.json');
    const temporaryTypes = resolve(temporaryDirectory, 'api.generated.d.ts');

    await generate(temporarySchema, temporaryTypes);
    await assertSame(schemaOutput, temporarySchema, 'OpenAPI document');
    await assertSame(typeOutput, temporaryTypes, 'Generated API types');
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}

const command = process.argv[2] ?? 'generate';

if (command === 'generate') {
  await generate(schemaOutput, typeOutput);
} else if (command === 'check') {
  await check();
} else {
  throw new Error(`Unknown OpenAPI command: ${command}`);
}
