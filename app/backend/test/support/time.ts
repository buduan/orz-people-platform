import { vi } from 'vitest';

export const FIXED_TEST_TIME = '2025-01-15T08:00:00.000Z';

export function installFixedTime(
  instant = FIXED_TEST_TIME,
  timezone = 'UTC',
): () => void {
  const previousTimezone = process.env.TZ;

  process.env.TZ = timezone;
  vi.useFakeTimers();
  vi.setSystemTime(new Date(instant));

  return () => {
    vi.useRealTimers();

    if (previousTimezone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTimezone;
    }
  };
}
