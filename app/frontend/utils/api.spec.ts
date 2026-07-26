import {
  afterEach, describe, expect, it, vi,
} from 'vitest';

import { apiStatuses, type ApiStatus } from '@orz-people-platform/types';

import { createApiClient } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

function createClient(response: {
  status: number;
  _data?: {
    status: ApiStatus;
    data: unknown;
    message?: string;
    timestamp: string;
  };
}) {
  const request = Object.assign(vi.fn(), {
    raw: vi.fn().mockResolvedValue(response),
  });
  vi.stubGlobal('$fetch', { create: vi.fn(() => request) });

  return createApiClient({
    baseURL: 'https://api.example.com',
    getAccessToken: () => null,
    getRefreshToken: () => null,
    onAccessTokenExpired: vi.fn(),
  });
}

describe('API response envelope', () => {
  it('unwraps data only when the business status is success', async () => {
    const client = createClient({
      status: 200,
      _data: {
        status: apiStatuses.success,
        data: { next: 'login' },
        timestamp: new Date().toISOString(),
      },
    });

    await expect(client.post('/auth/login/options')).resolves.toEqual({ next: 'login' });
  });

  it('rejects a non-success business status even for an HTTP 2xx response', async () => {
    const client = createClient({
      status: 200,
      _data: {
        status: apiStatuses.accountNotFound,
        data: null,
        message: 'Account not found',
        timestamp: new Date().toISOString(),
      },
    });

    await expect(client.post('/auth/login/options')).rejects.toMatchObject({
      httpStatus: 200,
      status: apiStatuses.accountNotFound,
      message: 'Account not found',
    });
  });
});
