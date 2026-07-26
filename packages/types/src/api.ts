export type ApiStatus = string | number;

export interface ApiResponse<T> {
  status: ApiStatus;
  data: T;
  message?: string;
  timestamp: string;
}

export interface ApiErrorResponse extends ApiResponse<null> {
  message: string;
}
