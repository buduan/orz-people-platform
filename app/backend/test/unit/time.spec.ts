import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import { FIXED_TEST_TIME, installFixedTime } from '../support/time';

let restore: (() => void) | undefined;

afterEach(() => {
  restore?.();
  restore = undefined;
});

describe('fixed time and timezone helper', () => {
  it('freezes the clock and sets the requested timezone', () => {
    restore = installFixedTime(FIXED_TEST_TIME, 'Asia/Shanghai');

    expect(new Date().toISOString()).toBe(FIXED_TEST_TIME);
    expect(new Intl.DateTimeFormat('en-CA', {
      hour: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    }).format(new Date())).toContain('GMT+8');
  });
});
