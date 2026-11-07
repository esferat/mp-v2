import { cookies } from 'next/headers';
import { decode } from 'next-auth/jwt';
import { getWebEnv } from './env';

/**
 * Серверное чтение токенов сессии из HttpOnly-куки (AC 1.1).
 *
 * access/id_token НЕ включаются в объект session — иначе Auth.js отдаёт их
 * клиенту в ответе GET /api/auth/session (любый JS на странице). Здесь кука
 * декодируется только на сервере (Server Components/actions/route handlers).
 */

const SESSION_COOKIE = 'authjs.session-token';

export interface SessionTokens {
  accessToken?: string;
  idToken?: string;
}

/** Токены текущей сессии или пустой объект, если сессии нет. */
export async function getSessionTokens(): Promise<SessionTokens> {
  const store = await cookies();
  const all = store.getAll().filter((cookie) => cookie.name.startsWith(SESSION_COOKIE));
  if (all.length === 0) return {};

  const token = joinChunks(all);
  if (!token) return {};

  // salt = имя базовой куки — то же, что использует Auth.js при encode
  const decoded = await decode({
    token,
    secret: getWebEnv().AUTH_SECRET,
    salt: SESSION_COOKIE,
  });

  return {
    ...(typeof decoded?.accessToken === 'string' ? { accessToken: decoded.accessToken } : {}),
    ...(typeof decoded?.idToken === 'string' ? { idToken: decoded.idToken } : {}),
  };
}

/** Длинная кука чанкуется Auth.js в authjs.session-token.N — склеиваем по порядку. */
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
