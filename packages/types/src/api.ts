export const apiStatuses = {
  success: 'success',
  badRequest: 'bad_request',
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  notFound: 'not_found',
  conflict: 'conflict',
  rateLimited: 'rate_limited',
  internalError: 'internal_error',
  unknown: 'unknown',
  accountNotFound: 'account_not_found',
  invalidCredentials: 'invalid_credentials',
  registrationExpired: 'registration_expired',
  registrationUnverified: 'registration_unverified',
  usernameUnavailable: 'username_unavailable',
} as const;

export type ApiStatus = (typeof apiStatuses)[keyof typeof apiStatuses];

export interface ApiResponse<T> {
  status: ApiStatus;
  data: T;
  message?: string;
  timestamp: string;
}

export interface ApiErrorResponse extends ApiResponse<null> {
  message: string;
}
