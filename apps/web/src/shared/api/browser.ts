import { type ApiClient, createApiClient } from './client';
import { type Api, createApi } from './namespaces';

/**
 * Клиентская инстанс (задача 2.3): ТОЛЬКО '/api/bff' — браузер не ходит
 * в gateway напрямую (fsd.md §6, №10). Модуль не зависит от серверного
 * кода (auth/gateway) — его можно импортировать в 'use client' компонентах.
 */
export const browserApiClient: ApiClient = createApiClient({ baseUrl: '/api/bff' });
export const browserApi: Api = createApi(browserApiClient);
