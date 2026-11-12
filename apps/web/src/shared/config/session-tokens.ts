import { cookies } from 'next/headers';
import { decode } from 'next-auth/jwt';
import { getWebEnv } from './env';

/**
 * Серверное чтение токенов сессии из HttpOnly-куки (AC 1.1).
 *
 * access/id_token НЕ включаются в объект session — иначе Auth.js отдаёт их
 * клиенту в ответе GET /api/auth/session (любый JS на странице). Здесь кука
 * декодируется только на сервере (Server Components/actions/route handlers).
 *
 * HTTPS-режим Auth.js (@auth/core, cookie.ts) добавляет к имени префикс
 * `__Secure-`: без учёта префикса getSessionTokens() на https://*.mp-kit.local
 * не находил бы куку — SSR-запросы шли бы без токена и уходили на вход.
 */

const SESSION_COOKIE = 'authjs.session-token';
/** Secure-вариант куки (https: __Secure-authjs.session-token[.N]). */
const SECURE_SESSION_COOKIE = `__Secure-${SESSION_COOKIE}`;

export interface SessionTokens {
  accessToken?: string;
  idToken?: string;
  /** Refresh token из сессии — для тихого обновления истёкшего access (SSR). */
  refreshToken?: string;
}

/** Разобранные куки сессии: склеенный JWT + salt для decode (чистая функция). */
export interface ParsedSessionCookie {
  token: string;
  /** Имя базовой куки (без чанка .N) — salt при encode/decode у Auth.js. */
  salt: string;
}

/**
 * Куки сессии → JWT + salt. Понимает оба семейства имён (обычное и
 * `__Secure-`) и чанки `...token.N` (длинная кука режется Auth.js).
 * Чистая функция — тестируется без Next-runtime.
 */
export function parseSessionCookies(
  all: readonly { name: string; value: string }[],
): ParsedSessionCookie | null {
  const parts = all.filter(
    (cookie) =>
      cookie.name === SESSION_COOKIE ||
      cookie.name === SECURE_SESSION_COOKIE ||
      cookie.name.startsWith(`${SESSION_COOKIE}.`) ||
      cookie.name.startsWith(`${SECURE_SESSION_COOKIE}.`),
  );
  if (parts.length === 0) return null;

  const token = joinChunks(parts);
  if (!token) return null;

  // salt = имя БАЗОВОЙ куки (без чанка .N): то же, что Auth.js передаёт в
  // encode/decode (options.cookies.sessionToken.name, включая __Secure-)
  return { token, salt: parts[0]!.name.replace(/\.\d+$/, '') };
}

/** Токены текущей сессии или пустой объект, если сессии нет. */
export async function getSessionTokens(): Promise<SessionTokens> {
  const store = await cookies();
  const parsed = parseSessionCookies(store.getAll());
  if (!parsed) return {};

  const decoded = await decode({
    token: parsed.token,
    secret: getWebEnv().AUTH_SECRET,
    salt: parsed.salt,
  });

  return {
    ...(typeof decoded?.accessToken === 'string' ? { accessToken: decoded.accessToken } : {}),
    ...(typeof decoded?.idToken === 'string' ? { idToken: decoded.idToken } : {}),
    ...(typeof decoded?.refreshToken === 'string' ? { refreshToken: decoded.refreshToken } : {}),
  };
}

/** Длинная кука чанкуется Auth.js в <имя>.N — склеиваем по порядку. */
function joinChunks(parts: readonly { name: string; value: string }[]): string {
  if (parts.length === 1) return parts[0]!.value;
  return [...parts]
    .sort((a, b) => suffixOf(a.name) - suffixOf(b.name))
    .map((part) => part.value)
    .join('');
}

function suffixOf(name: string): number {
  const suffix = Number.parseInt(name.split('.').pop() ?? '', 10);
  return Number.isNaN(suffix) ? -1 : suffix;
}
