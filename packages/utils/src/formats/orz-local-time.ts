import { ORZ_LOCAL_TIME_FORMAT } from '@orz-people-platform/types';

const LOCAL_TIME_PATTERN = /^(\d{2}):(\d{2}):(\d{2})$/u;

export { ORZ_LOCAL_TIME_FORMAT };

/** Validates the platform's timezone-free, second-precision time format. */
export function isOrzLocalTime(value: string): boolean {
  const match = LOCAL_TIME_PATTERN.exec(value);

  if (!match) {
    return false;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);

  return hours <= 23 && minutes <= 59 && seconds <= 59;
}
