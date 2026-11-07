/**
 * Единый HTTP-клиент web (задача 2.3).
 *
 * Две инстанции (AC):
 * - `browserApi` — '/api/bff' (браузер не ходит в gateway напрямую);
 * - `createServerApi()` — gateway напрямую с токеном сессии (SSR, 2.6).
 */

export { browserApi, browserApiClient } from './browser';
export { createServerApi, createServerClient } from './server';
export { createApiClient } from './client';
export type { ApiClient, ApiClientOptions, FetchLike, RequestOptions } from './client';
export { createApi } from './namespaces';
export type { Api } from './namespaces';
export { ApiError, toApiError } from './errors';
