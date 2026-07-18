export interface ApiMetadata {
  requestId: string;
  timestamp: string;
}

export interface ApiSuccess<T> {
  data: T;
  meta: ApiMetadata;
}

/** @deprecated Use ApiSuccess. */
export type ApiResponse<T> = ApiSuccess<T>;

export interface ApiFieldError {
  code: string;
  keyword: string;
  message: string;
  pointer: string;
}

export interface ApiErrorBody {
  code: string;
  fieldErrors?: ApiFieldError[];
  message: string;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
  meta: ApiMetadata;
}

export type ApiResult<T> = ApiSuccess<T> | ApiErrorResponse;
