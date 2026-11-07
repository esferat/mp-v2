'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { signIn, signOut } from '@/shared/config/auth';
import { getSessionTokens } from '@/shared/config/session-tokens';
import { getWebEnv } from '@/shared/config/env';

/**
 * Серверные действия входа/выхода (задача 1.1).
 * Токены не покидают сервер: здесь только редиректы и HttpOnly-кука.
 *
 * NB: origin берётся из заголовков запроса (Origin/Referer), а не из AUTH_URL —
 * портал живёт на нескольких хостах (localhost:3000, localhost:8080,
 * *.mp-kit.local), и logout/callback должны возвращать на ТЕКУЩИЙ хост.
 */

/** Origin текущего запроса: Origin → Referer → AUTH_URL (dev-фолбэк). */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const raw = h.get('origin') ?? h.get('referer');
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      /* не URL — фолбэк ниже */
    }
  }
  return new URL(getWebEnv().AUTH_URL).origin;
}

/** Вход: redirect в Keycloak с возвратом на исходную страницу (callbackUrl). */
export async function signInAction(callbackUrl = '/'): Promise<void> {
  await signIn('keycloak', { redirectTo: sanitizeCallback(callbackUrl, await requestOrigin()) });
}

/**
 * Выход: локальная инвалидация куки + backchannel logout в Keycloak
 * (id_token_hint) — сессия завершается и на стороне Keycloak (1.1 AC).
 */
export async function signOutAction(): Promise<void> {
  // id_token читается из HttpOnly-куки ДО её инвалидации (AC 1.1)
  const { idToken } = await getSessionTokens();
  const issuer = getWebEnv().AUTH_KEYCLOAK_ISSUER;
  const origin = await requestOrigin();

  await signOut({ redirect: false });

  if (idToken) {
    const logoutUrl = new URL(`${issuer}/protocol/openid-connect/logout`);
    logoutUrl.searchParams.set('id_token_hint', idToken);
    // post_logout_redirect.uris = "+" в реалме — принимаем любой origin запроса
    logoutUrl.searchParams.set('post_logout_redirect_uri', `${origin}/`);
    redirect(logoutUrl.toString());
  }

  redirect('/');
}

/** Только относительные пути или свой origin — open redirect исключён. */
function sanitizeCallback(callbackUrl: string, ownOrigin: string): string {
  if (callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')) {
    return callbackUrl;
  }
  try {
    const target = new URL(callbackUrl);
    if (target.origin === ownOrigin) return target.pathname + target.search;
  } catch {
    /* не URL — откат к корню */
  }
  return '/';
}
