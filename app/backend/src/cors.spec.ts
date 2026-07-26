import { describe, expect, it } from 'vitest';

import { isCorsOriginAllowed } from './cors';

describe('CORS origin validation', () => {
  it('allows APP_ORIGIN and requests without an Origin header', () => {
    expect(isCorsOriginAllowed(undefined, 'https://app.example.com', false)).toBe(true);
    expect(isCorsOriginAllowed('https://app.example.com', 'https://app.example.com/', false))
      .toBe(true);
    expect(isCorsOriginAllowed('https://other.example.com', 'https://app.example.com', false))
      .toBe(false);
  });

  it('allows loopback and private-network origins only in development', () => {
    const localOrigins = [
      'http://localhost:3001',
      'http://auth.localhost:3001',
      'http://localhost.localdomain:3001',
      'http://0.0.0.0:3001',
      'http://127.0.0.2:3001',
      'http://10.0.0.8:3001',
      'http://172.16.0.8:3001',
      'http://192.168.1.8:3001',
      'http://[::1]:3001',
    ];

    localOrigins.forEach((origin) => {
      expect(isCorsOriginAllowed(origin, undefined, true)).toBe(true);
      expect(isCorsOriginAllowed(origin, undefined, false)).toBe(false);
    });
    expect(isCorsOriginAllowed('http://8.8.8.8:3001', undefined, true)).toBe(false);
  });
});
