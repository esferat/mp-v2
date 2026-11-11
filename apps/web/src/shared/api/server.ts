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
 * Опции серверного клиента.
 */
export interface ServerClientOptions {
  /**
   * Тихое обновление токена при 401 (SSR-страницы): refresh + повтор;
   * если обновить невозможно — redirect на вход с `?expired=1` (мёртвая
   * сессия сбрасывается гардом — без этого «залогинен → главная → раздел
   * → 401 → вход» зациклится).
   *
   * BFF-прокси выключает: 401 он отдаёт браузеру как есть — кукю обновляет
   * и повтор делает сам браузер (2.3), редирект для XHR бессмыслен.
   */
  refreshOnUnauthorized?: boolean;
}

/**
 * Фабрика серверного HTTP-клиента (задачи 2.3/2.6): gateway напрямую
 * с access-токеном сессии. Токен читается из HttpOnly-куки на сервере
 * и в DOM/ответы не попадает (AC 1.1).
 * Импортировать ТОЛЬКО из Server Components/actions/route handlers.
 *
 * Использование:
 * - `createServerClient({ refreshOnUnauthorized: false })` — прокси BFF (2.6);
 * - `createServerApi()` — типизированные namespace-вызовы из SSR-страниц.
 */
export async function createServerClient(options: ServerClientOptions = {}): Promise<ApiClient> {
  const { refreshOnUnauthorized = true } = options;
  const { accessToken, refreshToken } = await getSessionTokens();
  // Пути namespace — без '/api' (как у BFF), а gateway принимает только
  // '/api/<service>/**' — префикс добавляется здесь (единственная точка).
  const gateway = getWebEnv().GATEWAY_INTERNAL_URL.replace(/\/$/, '');
  return createApiClient({
    baseUrl: `${gateway}/api`,
    headers: (): Record<string, string> =>
      accessToken ? { authorization: `Bearer ${accessToken}` } : {},
    ...(refreshOnUnauthorized
      ? {
          /**
           * Истёкший access в SSR (401 «Токен просрочен»): тихий refresh через
           * refresh_token сессии — пользователь ничего не замечает. Обновить
           * невозможно (нет refresh/invalid_grant) — сессия мертва: уход на
           * вход с callbackUrl текущей страницы (NEXT_REDIRECT всплывает
           * наружу без перехвата, страница не рендерится).
           */
          onUnauthorized: async (): Promise<string | null> => {
            if (refreshToken) {
              const env = getWebEnv();
              const fresh = await refreshAccessToken(
                { refreshToken },
                `${env.AUTH_KEYCLOAK_INTERNAL_URL}/realms/${env.AUTH_KEYCLOAK_REALM}`,
                env.AUTH_KEYCLOAK_ID,
                env.AUTH_KEYCLOAK_SECRET,
              );
              if (!fresh.error && typeof fresh.accessToken === 'string') {
                return fresh.accessToken;
              }
            }
            redirect(await loginUrl());
          },
        }
      : {}),
  });
}

/**
 * Страница входа с callbackUrl текущей страницы (из referer запроса).
 * `expired=1` — сессия мертва (refresh не прошёл): гард в proxy сбрасывает
 * куки перед уходом в Keycloak — иначе вход видит «живую» JWT-куку,
 * ведёт на главную, та — обратно в раздел, и редиректы зацикливаются.
 */
async function loginUrl(): Promise<string> {
  const params = new URLSearchParams({ expired: '1' });
  try {
    const raw = (await headers()).get('referer');
    if (raw) {
      const url = new URL(raw);
      const path = `${url.pathname}${url.search}`;
      if (path.startsWith('/') && !path.startsWith('//')) {
        params.set('callbackUrl', path);
      }
    }
  } catch {
    // заголовки недоступны (вне request-контекста) — дефолтный вход
  }
  return `/auth/login?${params.toString()}`;
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
