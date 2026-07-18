export type NodeEnvironment = 'development' | 'production' | 'test';

export interface Environment {
  APP_ORIGIN: string;
  BETTER_AUTH_SECRET: string;
  DATABASE_URL: string;
  MASTER_ENCRYPTION_KEY: string;
  NODE_ENV: NodeEnvironment;
  PASSKEY_ORIGIN: string;
  PASSKEY_RP_ID: string;
  PORT: number;
  REDIS_URL: string;
  WORKER_HEALTH_PORT: number;
}

const NODE_ENVIRONMENTS = new Set<NodeEnvironment>(['development', 'production', 'test']);

function requiredString(environment: Record<string, unknown>, key: string): string {
  const value = environment[key];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}

function port(environment: Record<string, unknown>, key: string, fallback: number): number {
  const rawValue = environment[key];
  const value = rawValue === undefined || rawValue === '' ? fallback : Number(rawValue);

  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`${key} must be an integer between 1 and 65535.`);
  }

  return value;
}

function url(value: string, key: string, protocols: readonly string[]): URL {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${key} must be a valid URL.`);
  }

  if (!protocols.includes(parsed.protocol)) {
    throw new Error(`${key} must use ${protocols.join(' or ')}.`);
  }

  return parsed;
}

function origin(value: string, key: string): URL {
  const parsed = url(value, key, ['http:', 'https:']);

  if (parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '') {
    throw new Error(`${key} must be an origin without a path, query, or fragment.`);
  }

  return parsed;
}

function encryptionKey(value: string): string {
  if (!/^[A-Za-z0-9+/]{43}=$/u.test(value)) {
    throw new Error('MASTER_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  }

  const decoded = Buffer.from(value, 'base64');

  if (decoded.length !== 32 || decoded.toString('base64') !== value) {
    throw new Error('MASTER_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  }

  return value;
}

export function validateEnvironment(environment: Record<string, unknown>): Environment {
  const rawNodeEnvironment = environment.NODE_ENV ?? 'development';

  if (typeof rawNodeEnvironment !== 'string'
    || !NODE_ENVIRONMENTS.has(rawNodeEnvironment as NodeEnvironment)) {
    throw new Error('NODE_ENV must be development, production, or test.');
  }

  const nodeEnvironment = rawNodeEnvironment as NodeEnvironment;
  const appOrigin = origin(requiredString(environment, 'APP_ORIGIN'), 'APP_ORIGIN');
  const passkeyOrigin = origin(
    requiredString(environment, 'PASSKEY_ORIGIN'),
    'PASSKEY_ORIGIN',
  );
  const rpId = requiredString(environment, 'PASSKEY_RP_ID').toLowerCase();
  const authSecret = requiredString(environment, 'BETTER_AUTH_SECRET');

  if (authSecret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters.');
  }

  const localDevelopmentOrigin = ['localhost', '127.0.0.1', '::1'].includes(appOrigin.hostname);

  if (nodeEnvironment === 'production'
    && appOrigin.protocol !== 'https:'
    && !localDevelopmentOrigin) {
    throw new Error('APP_ORIGIN must use HTTPS in production.');
  }

  if (passkeyOrigin.hostname !== rpId && !passkeyOrigin.hostname.endsWith(`.${rpId}`)) {
    throw new Error('PASSKEY_RP_ID must equal or be a parent domain of PASSKEY_ORIGIN.');
  }

  url(requiredString(environment, 'DATABASE_URL'), 'DATABASE_URL', ['postgres:', 'postgresql:']);
  url(requiredString(environment, 'REDIS_URL'), 'REDIS_URL', ['redis:', 'rediss:']);

  return {
    APP_ORIGIN: appOrigin.origin,
    BETTER_AUTH_SECRET: authSecret,
    DATABASE_URL: requiredString(environment, 'DATABASE_URL'),
    MASTER_ENCRYPTION_KEY: encryptionKey(requiredString(environment, 'MASTER_ENCRYPTION_KEY')),
    NODE_ENV: nodeEnvironment,
    PASSKEY_ORIGIN: passkeyOrigin.origin,
    PASSKEY_RP_ID: rpId,
    PORT: port(environment, 'PORT', 3000),
    REDIS_URL: requiredString(environment, 'REDIS_URL'),
    WORKER_HEALTH_PORT: port(environment, 'WORKER_HEALTH_PORT', 3002),
  };
}
