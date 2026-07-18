import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const OPENAPI_ENVIRONMENT = {
  APP_ORIGIN: 'http://localhost:3001',
  BETTER_AUTH_SECRET: 'openapi-only-secret-with-at-least-32-characters',
  DATABASE_URL: 'postgresql://openapi:openapi@localhost:5432/openapi?schema=public',
  MASTER_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  NODE_ENV: 'test',
  PASSKEY_ORIGIN: 'http://localhost:3001',
  PASSKEY_RP_ID: 'localhost',
  PORT: '3000',
  REDIS_URL: 'redis://localhost:6379/0',
  WORKER_HEALTH_PORT: '3002',
} as const;

async function writeOpenApi(): Promise<void> {
  Object.entries(OPENAPI_ENVIRONMENT).forEach(([key, value]) => {
    process.env[key] ??= value;
  });

  const [{ NestFactory }, { AppModule }, { createOpenApiDocument }] = await Promise.all([
    import('@nestjs/core'),
    import('../app.module.js'),
    import('./openapi.js'),
  ]);
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = createOpenApiDocument(app);
  const defaultOutput = resolve(process.cwd(), '../../openapi/openapi.json');
  const outputArgument = process.argv.slice(2).find((argument) => argument !== '--');
  const output = resolve(outputArgument ?? defaultOutput);

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  await app.close();
}

writeOpenApi().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
