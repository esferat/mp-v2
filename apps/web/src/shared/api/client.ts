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
  /**
   * 401 «Токен просрочен» (серверный путь): обновить access токен и
   * вернуть его — запрос повторяется незаметно для пользователя;
   * вернуть null — обновить не удалось (клиент бросит исходную 401);
   * бросить исключение (redirect на /auth/login) — обновить невозможно,
   * пользователь уходит на авторизацию.
   */
  onUnauthorized?: () => Promise<string | null>;
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
    onUnauthorized,
  } = options;

  /**
   * Свежий access после refresh (серверный путь): заменяет истёкший токен
   * и для повтора, и для последующих запросов этого клиента — один refresh
   * на createServerApi вместо каждого запроса.
   */
  let refreshedAccessToken: string | null = null;
  /** Параллельные 401 (Promise.all на странице) делят ОДИН refresh. */
  let refreshInFlight: Promise<string | null> | null = null;

  async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
    const method = (init.method ?? 'GET').toUpperCase();
    const idempotent = method === 'GET' || method === 'HEAD';
    const attempts = init.noRetry || !idempotent ? 1 : retryOnServerError + 1;

    let lastError: ApiError | null = null;

    let attempt = 0;
    let retriedAfterRefresh = false;

    while (attempt < attempts) {
      try {
        return await requestOnce<T>(path, init, method);
      } catch (error) {
        const apiError = toApiErrorInternal(error);
        lastError = apiError;
        // Истёкший access token: первый запрос после TTL падает 401 —
        // обновляем токен и повторяем ОДИН раз; выполнение запроса на 401 не
        // начиналось, поэтому это безопасно и для мутаций (в отличие от ретрая 5xx).
        if (apiError.status === 401 && !retriedAfterRefresh) {
          retriedAfterRefresh = true;
          if (onUnauthorized) {
            // Серверный путь: refresh сам; может бросить redirect('/auth/login'),
            // если обновить невозможно — NEXT_REDIRECT всплывает наружу без
            // перехвата (пользователь уходит на авторизацию вместо ошибки).
            // Параллельные запросы (Promise.all) разделяют один refresh.
            refreshInFlight ??= onUnauthorized().finally(() => {
              refreshInFlight = null;
            });
            const fresh = await refreshInFlight;
            if (fresh) {
              refreshedAccessToken = fresh;
              continue; // повтор с обновлённым токеном
            }
            throw apiError;
          }
          if (baseUrl.startsWith('/')) {
            await refreshSessionCookie();
            continue; // повтор той же попытки с обновлённой кукой
          }
        }
        const retryable = apiError.isNetworkError || apiError.isServerError;
        if (!retryable || attempt === attempts - 1) throw apiError;
        // Экспоненциальная пауза: 200мс, 400мс…
        await sleep(200 * 2 ** attempt);
        attempt += 1;
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
          // Свежий токен после refresh перебивает истёкший из headers()
          ...(refreshedAccessToken ? { authorization: `Bearer ${refreshedAccessToken}` } : {}),
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
  let field: string | undefined;

  try {
    const body = (await response.json()) as {
      code?: string;
      message?: string;
      field?: string;
      requestId?: string;
    };
    if (body.code) code = body.code;
    if (body.message) message = body.message;
    if (body.field) field = body.field;
    if (body.requestId) requestId = body.requestId;
  } catch {
    // Не-JSON тело — оставляем дефолтные поля
  }

  return new ApiError(message, {
    code,
    status: response.status,
    ...(field ? { field } : {}),
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

/**
 * Просмотр сессии у Auth.js: jwt-callback обновляет истёкший access token
 * и пишет новую куку в ответ — после этого повтор запроса проходит.
 * Только для браузера ('/api/bff' baseUrl); на сервере вызов бессмысленен.
 */
async function refreshSessionCookie(): Promise<void> {
  try {
    await fetch('/api/auth/session', { cache: 'no-store', credentials: 'include' });
  } catch {
    // сбой обновления не должен маскировать исходную ошибку 401
  }
}
