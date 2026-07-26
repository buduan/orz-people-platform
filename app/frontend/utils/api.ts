import {
  apiStatuses,
  type ApiErrorResponse,
  type ApiResponse,
  type ApiStatus,
} from '@orz-people-platform/types';

/**
 * 鉴权模式：
 * - `none`   — 不携带 token（公开接口，如登录、注册）
 * - `access` — 携带 Access Token（默认，绝大多数受保护接口）
 * - `refresh`— 携带 Refresh Token（仅用于刷新 access token 的接口）
 */
export type AuthMode = 'none' | 'access' | 'refresh';

/**
 * 请求选项，基于 ofetch 的 FetchOptions 并增加 auth 模式控制。
 * 使用 `typeof $fetch` 的参数类型推断，确保与 Nuxt 内置 $fetch 完全兼容。
 */
export type ApiRequestOptions = Omit<NonNullable<Parameters<typeof $fetch>[1]>, 'baseURL'> & {
  /** 鉴权模式，默认 `access` */
  auth?: AuthMode;
};

/** 结构化 API 错误，分别携带 HTTP 状态码和响应体业务状态码。 */
export class ApiError extends Error {
  public constructor(
    public readonly httpStatus: number,
    public readonly status: ApiStatus,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 从 ofetch FetchError 或原始错误中提取/转换为 ApiError */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  const fetchError = error as {
    data?: ApiErrorResponse;
    statusCode?: number;
    status?: number;
    message?: string;
  };

  const httpStatus = fetchError.statusCode ?? fetchError.status ?? 0;
  const body = fetchError.data;

  if (body?.message) {
    return new ApiError(
      httpStatus,
      body.status,
      body.message,
    );
  }

  return new ApiError(httpStatus, apiStatuses.unknown, fetchError.message ?? 'Unknown error');
}

/** API 客户端配置 */
export interface ApiClientOptions {
  baseURL: string;
  /** 获取当前 Access Token */
  getAccessToken: () => string | null;
  /** 获取当前 Refresh Token */
  getRefreshToken: () => string | null;
  /** Access Token 过期时的处理回调（预留，由 auth store 实现） */
  onAccessTokenExpired: () => void;
}

/** 创建带鉴权注入和统一错误处理的 API 客户端 */
export function createApiClient(options: ApiClientOptions) {
  const raw = $fetch.create({
    baseURL: options.baseURL,

    onResponseError({ response }) {
      // eslint-disable-next-line no-underscore-dangle -- ofetch uses _data for response body
      const body = response._data as ApiErrorResponse | undefined;
      if (body?.message) {
        throw new ApiError(
          response.status,
          body.status,
          body.message,
        );
      }
      throw new ApiError(response.status, apiStatuses.unknown, `HTTP ${response.status}`);
    },
  });

  /**
   * 根据 auth 模式解析出应携带的 token。
   * `access` 模式下若 token 不存在则交由调用方处理（后端会返回 401）。
   */
  function resolveToken(auth: AuthMode): string | null {
    if (auth === 'access') return options.getAccessToken();
    if (auth === 'refresh') return options.getRefreshToken();
    return null;
  }

  /**
   * 类型安全的请求方法。
   * 自动注入 Authorization header（按 auth 模式），自动解包 ApiResponse<T>。
   */
  async function request<T>(
    url: string,
    opts: ApiRequestOptions = {},
  ): Promise<T> {
    const { auth = 'access', headers, ...rest } = opts;
    const token = resolveToken(auth);

    const finalHeaders = new Headers(headers);
    if (token) {
      finalHeaders.set('Authorization', `Bearer ${token}`);
    }

    try {
      const response = await raw.raw<ApiResponse<T>>(url, {
        ...rest,
        headers: finalHeaders,
      });
      // ofetch exposes the parsed response body through its `_data` field.
      // eslint-disable-next-line no-underscore-dangle
      const envelope = response._data;
      if (!envelope) {
        throw new ApiError(
          response.status,
          apiStatuses.unknown,
          'Invalid API response',
        );
      }
      if (envelope.status !== apiStatuses.success) {
        throw new ApiError(
          response.status,
          envelope.status,
          envelope.message ?? 'Request failed',
        );
      }
      return envelope.data;
    } catch (error) {
      const apiError = toApiError(error);

      // 预留：Access Token 过期处理（401 且使用的是 access 模式）
      // 待后端确认 JWT 携带的信息后，可在此处实现更精细的过期判断
      if (apiError.httpStatus === 401 && auth === 'access') {
        options.onAccessTokenExpired();
      }

      throw apiError;
    }
  }

  return {
    /** GET 请求 */
    get<T>(url: string, opts?: ApiRequestOptions): Promise<T> {
      return request<T>(url, { ...opts, method: 'GET' });
    },
    /** POST 请求 */
    post<T>(
      url: string,
      body?: unknown,
      opts?: ApiRequestOptions,
    ): Promise<T> {
      return request<T>(url, {
        ...opts,
        method: 'POST',
        body: body as NonNullable<ApiRequestOptions['body']>,
      });
    },
    /** PATCH 请求 */
    patch<T>(
      url: string,
      body?: unknown,
      opts?: ApiRequestOptions,
    ): Promise<T> {
      return request<T>(url, {
        ...opts,
        method: 'PATCH',
        body: body as NonNullable<ApiRequestOptions['body']>,
      });
    },
    /** PUT 请求 */
    put<T>(
      url: string,
      body?: unknown,
      opts?: ApiRequestOptions,
    ): Promise<T> {
      return request<T>(url, {
        ...opts,
        method: 'PUT',
        body: body as NonNullable<ApiRequestOptions['body']>,
      });
    },
    /** DELETE 请求 */
    delete<T>(url: string, opts?: ApiRequestOptions): Promise<T> {
      return request<T>(url, { ...opts, method: 'DELETE' });
    },
    /** 原始客户端（不自动解包 ApiResponse，用于特殊场景） */
    raw,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
