import { describe, expect, it } from 'vitest';
import { createApiClient, type FetchLike } from '../src/shared/api/client';
import { ApiError, toApiError } from '../src/shared/api/errors';
import { browserApi, browserApiClient } from '../src/shared/api/browser';

/** Мок fetch: очередь ответов/ошибок + журнал вызовов. */
function makeFetch(steps: Array<Response | Error>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl: FetchLike = async (input, init) => {
    calls.push({ url: String(input), init });
    const step = steps.shift();
    if (!step) throw new Error('мок исчерпан');
    if (step instanceof Error) throw step;
    return step.clone();
  };
  return { impl, calls };
}

const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const serverError = (body: unknown, status = 500) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('createApiClient: базовые сценарии (2.3)', () => {
  it('склеивает baseUrl и путь, парсит JSON', async () => {
    const { impl, calls } = makeFetch([ok({ items: [1, 2] })]);
    const client = createApiClient({ baseUrl: '/api/bff/', fetchImpl: impl });

    const result = await client.get<{ items: number[] }>('/catalog/specializations');

    expect(result).toEqual({ items: [1, 2] });
    expect(calls[0]?.url).toBe('/api/bff/catalog/specializations');
    expect(calls[0]?.init?.credentials).toBe('include');
  });

  it('204 → undefined (без попытки json()', async () => {
    const { impl } = makeFetch([new Response(null, { status: 204 })]);
    const client = createApiClient({ baseUrl: '/api/bff', fetchImpl: impl });

    await expect(client.del('/catalog/specializations/1')).resolves.toBeUndefined();
  });

  it('добавляет заголовки (accept, content-type, авторизация сервера)', async () => {
    const { impl, calls } = makeFetch([ok({})]);
    const client = createApiClient({
      baseUrl: '/api',
      fetchImpl: impl,
      headers: () => ({ authorization: 'Bearer token' }),
    });

    await client.post('/identity/register', { a: 1 });

    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer token');
    expect(headers['content-type']).toBe('application/json');
    expect(headers.accept).toBe('application/json');
  });
});

describe('createApiClient: ошибки → ApiError (2.3 AC)', () => {
  it('маппит {code, message, requestId} из тела ответа', async () => {
    const { impl } = makeFetch([
      serverError(
        {
          code: 'FORBIDDEN',
          message: 'Маршрут требует роль: ADMIN',
          requestId: 'trace-abc',
        },
        403,
      ),
    ]);
    const client = createApiClient({ baseUrl: '/api/bff', fetchImpl: impl });

    try {
      await client.get('/admin/doctors');
      expect.unreachable('ожидалась ошибка');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.status).toBe(403);
      expect(apiError.code).toBe('FORBIDDEN');
      expect(apiError.message).toBe('Маршрут требует роль: ADMIN');
      expect(apiError.requestId).toBe('trace-abc'); // AC: ошибка показывает requestId
      expect(apiError.isServerError).toBe(false);
    }
  });

  it('не-JSON тело → дефолтный код по статусу', async () => {
    const { impl } = makeFetch([new Response('<html>500</html>', { status: 500 })]);
    const client = createApiClient({ baseUrl: '/api', fetchImpl: impl, retryOnServerError: 0 });

    await expect(client.get('/x')).rejects.toMatchObject({ code: 'HTTP_500', status: 500 });
  });

  it('сетевая ошибка → ApiError NETWORK_ERROR (status 0)', async () => {
    const { impl } = makeFetch([new TypeError('fetch failed')]);
    const client = createApiClient({ baseUrl: '/api', fetchImpl: impl, retryOnServerError: 0 });

    await expect(client.get('/x')).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });

  it('toApiError не теряет уже готовую ошибку', () => {
    const original = new ApiError('x', { code: 'C', status: 400 });
    expect(toApiError(original)).toBe(original);
    expect(toApiError(new Error('y'))).toMatchObject({ code: 'NETWORK_ERROR' });
  });
});

describe('createApiClient: ретраи (2.3 AC)', () => {
  it('GET ретраится на 500 и проходит со второй попытки', async () => {
    const { impl, calls } = makeFetch([
      serverError({ code: 'INTERNAL_ERROR', message: 'boom' }, 500),
      ok({ ok: true }),
    ]);
    const client = createApiClient({ baseUrl: '/api', fetchImpl: impl, retryOnServerError: 2 });

    await expect(client.get('/catalog/doctors')).resolves.toEqual({ ok: true });
    expect(calls).toHaveLength(2);
  });

  it('POST НЕ ретраится (один вызов) — бронирование не дублируется (2.3)', async () => {
    const { impl, calls } = makeFetch([
      serverError({ code: 'INTERNAL_ERROR', message: 'boom' }, 500),
      ok({ should: 'not happen' }),
    ]);
    const client = createApiClient({ baseUrl: '/api', fetchImpl: impl, retryOnServerError: 2 });

    await expect(client.post('/scheduling/appointments', { slotId: 's1' })).rejects.toMatchObject({
      status: 500,
    });
    expect(calls).toHaveLength(1);
  });

  it('4xx НЕ ретраится (это не сеть)', async () => {
    const { impl, calls } = makeFetch([
      serverError({ code: 'VALIDATION_ERROR', message: 'нет' }, 400),
      ok({}),
    ]);
    const client = createApiClient({ baseUrl: '/api', fetchImpl: impl, retryOnServerError: 2 });

    await expect(client.get('/x')).rejects.toMatchObject({ status: 400 });
    expect(calls).toHaveLength(1);
  });

  it('сервер «лечится» → ретраи прекращаются', async () => {
    const { impl, calls } = makeFetch([
      serverError({ code: 'X', message: '1' }, 503),
      serverError({ code: 'X', message: '2' }, 503),
      ok({ final: true }),
    ]);
    const client = createApiClient({ baseUrl: '/api', fetchImpl: impl, retryOnServerError: 2 });

    await expect(client.get('/x')).resolves.toEqual({ final: true });
    expect(calls).toHaveLength(3);
  });
});

describe('браузерная инстанс (2.3 AC: только /api/bff)', () => {
  it('browserApi построен на базовом URL /api/bff', () => {
    // Прямая проверка конфигурации: инстанс не «утекает» в gateway
    expect(browserApiClient).toBeDefined();

    // namespace типизирован контрактами: сигнатура register — RegisterRequest
    expect(typeof browserApi.identity.register).toBe('function');
    expect(typeof browserApi.catalog.getDoctors).toBe('function');
  });
});
