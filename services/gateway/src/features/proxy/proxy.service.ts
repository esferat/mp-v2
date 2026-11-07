import { HttpException, Inject, Injectable } from '@nestjs/common';
import { getTraceId } from '@mp/service-kit';
import { Readable } from 'node:stream';
import { parseServiceUrls, getGatewayEnv } from '../../shared/config';

/** Заголовки, которые не пересылаются между hop'ами (RFC 9110). */
const HOP_BY_HOP = new Set([
  'host',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',
]);

/** Тело запроса — тот же тип, что у глобального fetch (undici). */
export type FetchBody = NonNullable<RequestInit['body']>;

/** Функция запроса — подменяется в тестах (вместо глобального fetch). */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** DI-токен HTTP-клиента прокси (в тестах подменяется на фейк). */
export const FETCH = Symbol('GatewayFetch');

/** Профиль входящего запроса (минимум, нужный прокси). */
export interface ProxyRequestLike {
  method: string;
  originalUrl: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  /** Входящий стрим — для multipart (тело не парсится body-parser'ом). */
  readable?: Readable;
}

export interface UpstreamResponse {
  status: number;
  headers: Record<string, string | string[]>;
  /**
   * Тело как есть (Web ReadableStream) — без буферизации в памяти:
   * файлы/отчёты проксируются стримом, TTFB не ждёт полного ответа.
   */
  body: ReadableStream<Uint8Array> | null;
}

/**
 * Проксирование на сервисы (1.2): `/api/<service>/**` → внутренний адрес.
 * Таймаут бэкенда → 504, недоступен → 502, неизвестный сервис → 404 —
 * всё в едином формате ApiError `{code, message, requestId}`.
 */
@Injectable()
export class ProxyService {
  private readonly urls: Record<string, string>;
  private readonly timeoutMs: number;

  constructor(@Inject(FETCH) private readonly fetchImpl: FetchLike) {
    const env = getGatewayEnv();
    this.urls = parseServiceUrls(env.SERVICE_URLS);
    this.timeoutMs = env.PROXY_TIMEOUT_MS;
  }

  /** Целевой URL: base сервиса + полный исходный путь (сервисы живут под /api/<svc>/**). */
  resolveUpstream(service: string, originalUrl: string): string {
    const base = this.urls[service];
    if (!base) {
      throw new HttpException(
        { code: 'SERVICE_NOT_FOUND', message: `Неизвестный сервис: ${service}` },
        404,
      );
    }
    return `${base.replace(/\/$/, '')}${originalUrl}`;
  }

  /** Выполняет запрос к сервису, возвращая ответ как есть (status/headers/body). */
  async forward(
    method: string,
    target: string,
    request: ProxyRequestLike,
  ): Promise<UpstreamResponse> {
    const headers = buildForwardHeaders(request.headers);
    const body = buildRequestBody(method, request);

    let response: Response;
    try {
      response = await this.fetchImpl(target, {
        method,
        headers,
        ...(body !== undefined ? { body } : {}),
        redirect: 'manual',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw mapNetworkError(error, this.timeoutMs);
    }

    const outHeaders: Record<string, string | string[]> = {};
    response.headers.forEach((value, key) => {
      if (HOP_BY_HOP.has(key.toLowerCase())) return;
      outHeaders[key] = value;
    });

    return {
      status: response.status,
      headers: outHeaders,
      // Стрим: не материализуем тело в память (двойной буфер был ×2 на каждый ответ)
      body: response.body,
    };
  }
}

/** Копируем заголовки клиента, добавляя trace-id текущего запроса. */
function buildForwardHeaders(
  incoming: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue;
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) continue;
    headers[key] = Array.isArray(value) ? value.join(', ') : value;
  }

  // trace-id: из входящего заголовка или из AsyncLocalStorage (сгенерирован
  // trace-id middleware) — он же попадает в логи сервиса (1.2 AC)
  headers['x-request-id'] ??= getTraceId() ?? headers['x-request-id'] ?? '';
  if (!headers['x-request-id']) delete headers['x-request-id'];

  return headers;
}

/** Тело: JSON-объект → строка, multipart → исходный стрим, GET/HEAD → нет. */
function buildRequestBody(method: string, request: ProxyRequestLike): FetchBody | undefined {
  const upper = method.toUpperCase();
  if (upper === 'GET' || upper === 'HEAD') return undefined;

  const contentType = String(request.headers['content-type'] ?? '');
  if (contentType.includes('multipart/form-data') && request.readable) {
    // Body-parser multipart не трогает — пересылаем поток как есть
    return Readable.toWeb(request.readable) as unknown as FetchBody;
  }

  const { body } = request;
  if (body === undefined || body === null) return undefined;
  if (typeof body === 'string') return body;
  if (typeof body === 'object' && Object.keys(body as object).length === 0) return undefined;

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      params.set(key, String(value));
    }
    return params.toString();
  }

  return JSON.stringify(body);
}

/** Сетевые ошибки fetch → единые 502/504 ApiError. */
function mapNetworkError(error: unknown, timeoutMs: number): HttpException {
  const name = (error as { name?: string })?.name;
  if (name === 'AbortError' || name === 'TimeoutError') {
    return new HttpException(
      { code: 'GATEWAY_TIMEOUT', message: `Сервис не ответил за ${timeoutMs} мс` },
      504,
    );
  }
  const cause = (error as { cause?: { code?: string } })?.cause;
  return new HttpException(
    {
      code: 'BAD_GATEWAY',
      message: `Сервис недоступен${cause?.code ? ` (${cause.code})` : ''}`,
    },
    502,
  );
}
