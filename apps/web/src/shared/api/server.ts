import type { Specialization } from '@mp/contracts';
import { getWebEnv } from '@/shared/config';
import { getSessionTokens } from '@/shared/config/session-tokens';
import { type ApiClient, createApiClient } from './client';
import { getSpecializationsCached } from './catalog-cache';
import { ApiError } from './errors';
import { type Api, createApi } from './namespaces';

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
  // Пути namespace — без '/api' (как у BFF), а gateway принимает только
  // '/api/<service>/**' — префикс добавляется здесь (единственная точка).
  const gateway = getWebEnv().GATEWAY_INTERNAL_URL.replace(/\/$/, '');
  return createApiClient({
    baseUrl: `${gateway}/api`,
    headers: (): Record<string, string> =>
      accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  });
}

export async function createServerApi(): Promise<Api> {
  return createApi(await createServerClient());
}

/**
 * SSR-загрузка справочника специализаций для страниц форм (3.2): единый
 * формат ошибки { error, requestId } вместо дублирования в каждой странице.
 */
export async function loadSpecializations(): Promise<
  { items: Specialization[] } | { error: string; requestId?: string }
> {
  try {
    const api = await createServerApi();
    const items = await getSpecializationsCached(api);
    return { items };
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        error: error.message,
        ...(error.requestId ? { requestId: error.requestId } : {}),
      };
    }
    return { error: error instanceof Error ? error.message : 'Неизвестная ошибка' };
  }
}
