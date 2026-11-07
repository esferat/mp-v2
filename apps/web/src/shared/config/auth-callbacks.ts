/**
 * Чистые callbacks Auth.js (задача 1.1): логика вынесена из конфигурации,
 * чтобы unit-тесты проверяли её без Next.js и без сети.
 *
 * Токены живут ТОЛЬКО в HttpOnly-куке сессии (JWT-стратегия): в localStorage
 * и DOM не попадают (AC 1.1).
 */

import type { JWT } from 'next-auth/jwt';

/** Роли портала — те же, что в Keycloak realm (functional-spec §2). */
export const SESSION_ROLES = ['ADMIN', 'USER', 'DOCTOR'] as const;
export type SessionRole = (typeof SESSION_ROLES)[number];

/**
 * Что Auth.js кладёт в JWT-куку: стандартные поля JWT + наши (token и roles
 * добавлены augment'ом в src/types/next-auth.d.ts).
 */
export type JwtState = JWT;

export interface ProfileLike {
  sub?: string | null;
  email?: string | null;
  realm_access?: { roles?: unknown };
}

/** Роли из профиля Keycloak → известные порталу (мусор отбрасывается). */
export function extractRoles(profile: ProfileLike | undefined): SessionRole[] {
  const raw = profile?.realm_access?.roles;
  if (!Array.isArray(raw)) return [];
  return raw.filter((role): role is SessionRole =>
    (SESSION_ROLES as readonly string[]).includes(String(role)),
  );
}

/**
 * Роли из access_token: Keycloak кладёт realm_access ТОЛЬКО в access_token,
 * id_token его не содержит — поэтому при первом входе роли берём оттуда
 * (фолбэк на profile для провайдеров, отдающих роли в id_token).
 */
export function resolveRoles(
  profile: ProfileLike | undefined,
  accessToken?: string,
): SessionRole[] {
  const fromProfile = extractRoles(profile);
  if (fromProfile.length > 0) return fromProfile;
  if (!accessToken) return [];
  const payload = decodeJwtPayload(accessToken);
  const realmAccess = payload?.realm_access;
  if (!realmAccess || typeof realmAccess !== 'object') return [];
  return extractRoles({ realm_access: realmAccess as { roles?: unknown } });
}

/**
 * Payload JWT без проверки подписи — только для чтения claims (сервер).
 * atob/TextDecoder вместо Buffer: работает и в Node, и в edge-runtime (proxy).
 */
function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const part = jwt.split('.')[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
}

/**
 * Обновление access_token через refresh_token (прозрачное: вкладка живёт
 * дольше TTL без повторного ввода пароля — AC 1.1).
 *
 * Публичный клиент Keycloak (PKCE): client_secret не отправляется.
 */
export async function refreshAccessToken(
  token: JwtState,
  issuer: string,
  clientId: string,
  clientSecret: string,
  fetchImpl: typeof fetch = fetch,
): Promise<JwtState> {
  if (!token.refreshToken) {
    return { ...token, error: 'RefreshAccessTokenError' };
  }

  try {
    const url = `${issuer}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken,
      client_id: clientId,
    });
    if (clientSecret) body.set('client_secret', clientSecret);

    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      // Текст ответа безопасен (описание ошибки grant) и критичен для диагностики
      const detail = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status} ${detail.slice(0, 300)}`);
    }

    const refreshed = (await response.json()) as TokenResponse;
    return {
      ...token,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      idToken: refreshed.id_token ?? token.idToken,
      expiresAt: Date.now() + (refreshed.expires_in ?? 300) * 1000,
      error: undefined,
    };
  } catch (error) {
    // ВРЕМЕННО ДИАГНОСТИКА: показать причину сбоя обновления токена
    console.error('[auth] refresh token failed:', error);
    // Продолжаем со старым токеном; при следующем тике попробуем снова
    return { ...token, error: 'RefreshAccessTokenError' };
  }
}

/** Сколько миллисекунд до истечения access_token (отрицательно — истёк). */
export function msUntilExpiry(token: JwtState, now: number = Date.now()): number {
  if (!token.expiresAt) return Number.NEGATIVE_INFINITY;
  return token.expiresAt - now;
}
