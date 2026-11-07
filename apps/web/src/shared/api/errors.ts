/**
 * Единая ошибка HTTP-клиента (задача 2.3): формат ApiError из контрактов
 * `{code, message, requestId}` + HTTP-статус. Тосты показывают requestId —
 * по нему цепочка ищется в Kibana (AC 2.3).
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;

  constructor(message: string, options: { code: string; status: number; requestId?: string }) {
    super(message);
    this.name = 'ApiError';
    this.code = options.code;
    this.status = options.status;
    this.requestId = options.requestId;
  }

  /** Серверная ошибка (5xx) — общий экран с retry (2.4). */
  get isServerError(): boolean {
    return this.status >= 500;
  }

  /** Таймаут/сеть — тоже «повторяемо». */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

/** Любой сбой запроса → ApiError (единый маппинг для UI). */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new ApiError(message, { code: 'NETWORK_ERROR', status: 0 });
}
