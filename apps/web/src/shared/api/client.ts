import { ApiError } from './errors';

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface ApiClientOptions {
  /** Базовый путь: '/api/bff' (браузер) или адрес gateway (сервер). */
  baseUrl: string;
  /** Таймаут одного запроса, мс. */
  timeoutMs?: number;
  /** Повторы на 5xx/сетевых. POST/PUT/DELETE НЕ ретраятся (2.3). */
  retryOnServerError?: number;
  fetchImpl?: FetchLike;
  /** Дополнительные заголовки (например, Authorization на сервере). */
  headers?: () => Record<string, string>;
}

export interface RequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  /** Свой таймаут для этого запроса. */
  timeoutMs?: number;
  /** Отключить ретраи (например, для критичных POST). */
  noRetry?: boolean;
}

/** Публичный контракт клиента (им импортируют потребители). */
export interface ApiClient {
  request<T>(path: string, init?: RequestOptions): Promise<T>;
  get<T>(path: string, init?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, init?: RequestOptions): Promise<T>;
  put<T>(path: string, body?: unknown, init?: RequestOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, init?: RequestOptions): Promise<T>;
  del<T>(path: string, init?: RequestOptions): Promise<T>;
}

/**
 * HTTP-клиент (задача 2.3): единая точка fetch в web.
 *
 * - базовый URL ('/api/bff' в браузере — браузер НЕ ходит в gateway напрямую);
 * - таймаут + ретраи 5xx/сети (только для безопасных методов);
 * - ошибки → ApiError {code, message, requestId} из тела ответа.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const {
    baseUrl,
    timeoutMs = 15_000,
    retryOnServerError = 2,
    fetchImpl = fetch,
    headers: extraHeaders,
  } = options;

  async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
    const method = (init.method ?? 'GET').toUpperCase();
    const idempotent = method === 'GET' || method === 'HEAD';
    const attempts = init.noRetry || !idempotent ? 1 : retryOnServerError + 1;

    let lastError: ApiError | null = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await requestOnce<T>(path, init, method);
      } catch (error) {
        const apiError = toApiErrorInternal(error);
        lastError = apiError;
        const retryable = apiError.isNetworkError || apiError.isServerError;
        if (!retryable || attempt === attempts - 1) throw apiError;
        // Экспоненциальная пауза: 200мс, 400мс…
        await sleep(200 * 2 ** attempt);
      }
    }

    // Недостижимо, но для строгости возвращаем последнюю ошибку
    throw lastError ?? new ApiError('Неизвестная ошибка запроса', { code: 'UNKNOWN', status: 0 });
  }

  async function requestOnce<T>(path: string, init: RequestOptions, method: string): Promise<T> {
    const url = `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? timeoutMs);

    try {
      const response = await fetchImpl(url, {
        ...init,
        method,
        headers: {
          accept: 'application/json',
          ...(init.body !== undefined && typeof init.body === 'string'
            ? { 'content-type': 'application/json' }
            : {}),
          ...extraHeaders?.(),
          ...init.headers,
        },
        signal: init.signal ?? controller.signal,
        // Куки сессии (серверный BFF) — всегда
        credentials: 'include',
      });

      if (!response.ok) {
        throw await responseToApiError(response);
      }

      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      // AbortError → таймаут; TypeError → сеть
      const message = error instanceof Error ? error.message : String(error);
      throw new ApiError(`Запрос не выполнен: ${message}`, {
        code: 'NETWORK_ERROR',
        status: 0,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    request,
    get: <T>(path: string, init?: RequestOptions) => request<T>(path, { ...init, method: 'GET' }),
    post: <T>(path: string, body?: unknown, init?: RequestOptions) =>
      request<T>(path, {
        ...init,
        method: 'POST',
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    put: <T>(path: string, body?: unknown, init?: RequestOptions) =>
      request<T>(path, {
        ...init,
        method: 'PUT',
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    patch: <T>(path: string, body?: unknown, init?: RequestOptions) =>
      request<T>(path, {
        ...init,
        method: 'PATCH',
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    del: <T>(path: string, init?: RequestOptions) =>
      request<T>(path, { ...init, method: 'DELETE' }),
  };
}

/** Тело ошибки API → ApiError (единый формат контракта ApiError). */
async function responseToApiError(response: Response): Promise<ApiError> {
  let code = `HTTP_${response.status}`;
  let message = response.statusText || 'Ошибка запроса';
  let requestId: string | undefined;

  try {
    const body = (await response.json()) as {
      code?: string;
      message?: string;
      requestId?: string;
    };
    if (body.code) code = body.code;
    if (body.message) message = body.message;
    if (body.requestId) requestId = body.requestId;
  } catch {
    // Не-JSON тело — оставляем дефолтные поля
  }

  return new ApiError(message, {
    code,
    status: response.status,
    ...(requestId ? { requestId } : {}),
  });
}

function toApiErrorInternal(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new ApiError(message, { code: 'NETWORK_ERROR', status: 0 });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
