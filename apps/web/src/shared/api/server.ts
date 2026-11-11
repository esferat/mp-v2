import type { Specialization } from '@mp/contracts';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getWebEnv } from '@/shared/config';
import { getSessionTokens } from '@/shared/config/session-tokens';
import { refreshAccessToken } from '@/shared/config/auth-callbacks';
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
  const { accessToken, refreshToken } = await getSessionTokens();
  // Пути namespace — без '/api' (как у BFF), а gateway принимает только
  // '/api/<service>/**' — префикс добавляется здесь (единственная точка).
  const gateway = getWebEnv().GATEWAY_INTERNAL_URL.replace(/\/$/, '');
  return createApiClient({
    baseUrl: `${gateway}/api`,
    headers: (): Record<string, string> =>
      accessToken ? { authorization: `Bearer ${accessToken}` } : {},
    /**
     * Истёкший access в SSR (401 «Токен просрочен»): тихий refresh через
     * refresh_token сессии — пользователь ничего не замечает. Если обновить
     * невозможно (нет refresh/invalid_grant) — уход на страницу авторизации
     * с callbackUrl текущей страницы вместо ошибки на ней.
     */
    onUnauthorized: async (): Promise<string | null> => {
      if (!refreshToken) return null;
      const env = getWebEnv();
      const fresh = await refreshAccessToken(
        { refreshToken },
        `${env.AUTH_KEYCLOAK_INTERNAL_URL}/realms/${env.AUTH_KEYCLOAK_REALM}`,
        env.AUTH_KEYCLOAK_ID,
        env.AUTH_KEYCLOAK_SECRET,
      );
      if (fresh.error || typeof fresh.accessToken !== 'string') {
        // Обновить невозможно — на авторизацию (NEXT_REDIRECT всплывает наружу)
        redirect(await loginUrl());
      }
      return fresh.accessToken;
    },
  });
}

/** Страница входа с callbackUrl текущей страницы (из referer запроса). */
async function loginUrl(): Promise<string> {
  try {
    const raw = (await headers()).get('referer');
    if (raw) {
      const url = new URL(raw);
      const path = `${url.pathname}${url.search}`;
      if (path.startsWith('/') && !path.startsWith('//')) {
        return `/auth/login?callbackUrl=${encodeURIComponent(path)}`;
      }
    }
  } catch {
    // заголовки недоступны (вне request-контекста) — дефолтный вход
  }
  return '/auth/login';
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
