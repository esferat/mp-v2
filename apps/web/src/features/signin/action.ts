'use server';

import { redirect } from 'next/navigation';
import { signIn, signOut } from '@/shared/config/auth';
import { getSessionTokens } from '@/shared/config/session-tokens';
import { getWebEnv } from '@/shared/config/env';

/**
 * Серверные действия входа/выхода (задача 1.1).
 * Токены не покидают сервер: здесь только редиректы и HttpOnly-кука.
 */

/** Вход: redirect в Keycloak с возвратом на исходную страницу (callbackUrl). */
export async function signInAction(callbackUrl = '/'): Promise<void> {
  await signIn('keycloak', { redirectTo: sanitizeCallback(callbackUrl) });
}

/**
 * Выход: локальная инвалидация куки + backchannel logout в Keycloak
 * (id_token_hint) — сессия завершается и на стороне Keycloak (1.1 AC).
 */
export async function signOutAction(): Promise<void> {
  // id_token читается из HttpOnly-куки ДО её инвалидации (AC 1.1)
  const { idToken } = await getSessionTokens();
  const env = getWebEnv();

  await signOut({ redirect: false });

  if (idToken) {
    const logoutUrl = new URL(`${env.AUTH_KEYCLOAK_ISSUER}/protocol/openid-connect/logout`);
    logoutUrl.searchParams.set('id_token_hint', idToken);
    logoutUrl.searchParams.set('post_logout_redirect_uri', `${env.AUTH_URL}/`);
    redirect(logoutUrl.toString());
  }

  redirect('/');
}

/** Только относительные пути или свой origin — open redirect исключён. */
function sanitizeCallback(callbackUrl: string): string {
  if (callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')) {
    return callbackUrl;
  }
  try {
    const target = new URL(callbackUrl);
    const own = new URL(getWebEnv().AUTH_URL);
    if (target.origin === own.origin) return target.pathname + target.search;
  } catch {
    /* не URL — откат к корню */
  }
  return '/';
}
