import type Redis from 'ioredis';

const INCREMENT_WITH_FIXED_TTL = `
local value = redis.call('INCR', KEYS[1])
if value == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return value
`;

export interface BetterAuthSecondaryStorage {
  delete: (key: string) => Promise<void>;
  get: (key: string) => Promise<string | null>;
  getAndDelete: (key: string) => Promise<string | null>;
  increment: (key: string, ttl: number) => Promise<number>;
  set: (key: string, value: string, ttl?: number) => Promise<void>;
}

export function createBetterAuthSecondaryStorage(
  redis: Redis,
  keyPrefix = 'better-auth:',
): BetterAuthSecondaryStorage {
  const resolveKey = (key: string): string => `${keyPrefix}${key}`;

  return {
    delete: async (key) => {
      await redis.del(resolveKey(key));
    },
    get: (key) => redis.get(resolveKey(key)),
    getAndDelete: (key) => redis.getdel(resolveKey(key)),
    increment: async (key, ttl) => Number(await redis.eval(
      INCREMENT_WITH_FIXED_TTL,
      1,
      resolveKey(key),
      ttl,
    )),
    set: async (key, value, ttl) => {
      if (ttl === undefined) {
        await redis.set(resolveKey(key), value);
        return;
      }

      await redis.set(resolveKey(key), value, 'EX', ttl);
    },
  };
}
