import createClient from 'openapi-fetch';

import type { paths } from '../types/api.generated';

export interface CreateApiClientOptions {
  baseUrl: string;
}

export function createApiClient(options: CreateApiClientOptions) {
  return createClient<paths>({ baseUrl: options.baseUrl });
}

export type ApiClient = ReturnType<typeof createApiClient>;
