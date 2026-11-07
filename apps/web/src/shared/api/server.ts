import { getWebEnv } from '@/shared/config';
import { getSessionTokens } from '@/shared/config/session-tokens';
import { createApiClient, type ApiClient } from './client';
import { createApi, type Api } from './namespaces';

/**
 * Фабрика серверного HTTP-клиента (задачи 2.3/2.6): gateway напрямую
 * с access-токеном сессии. Токен читается из HttpOnly-куки на сервере
 * и в DOM/ответы не попадает (AC 1.1).
 * Импортировать ТОЛЬКО из Server Components/actions/route handlers.
 *
 * Использование:
 * - `createServerClient()` — универсальный прокси BFF (2.6);
 * - `createServerApi()` — типизированные namespace-вызовы из SSR-страниц.
 */
export async function createServerClient(): Promise<ApiClient> {
  const { accessToken } = await getSessionTokens();
  return createApiClient({
    baseUrl: getWebEnv().GATEWAY_INTERNAL_URL,
    headers: (): Record<string, string> =>
      accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  });
}

export async function createServerApi(): Promise<Api> {
  return createApi(await createServerClient());
}
