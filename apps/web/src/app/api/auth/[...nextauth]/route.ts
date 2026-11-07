import { NextRequest } from 'next/server';
import { handlers } from '@/shared/config/auth';

/**
 * Единый маршрут Auth.js (1.1): /api/auth/* → signin/signout/callback/session.
 * Запрашивает только сервер (SSR/действия) — браузер напрямую в Keycloak
 * ходит только через редирект авторизации.
 *
 * NB: Next standalone строит `request.url` из HOSTNAME контейнера (0.0.0.0),
 * а не из Host-заголовка — за nginx/доменами (*.mp-kit.local) это давало
 * redirect_uri http://0.0.0.0:3000 и ломало вход. Восстанавливаем origin
 * из заголовков прокси (X-Forwarded-Proto / X-Forwarded-Host / Host).
 */
/** POST /api/auth/*: тела Auth.js маленькие (form-urlencoded) — буферизуем. */
async function withProxyOrigin(request: NextRequest): Promise<NextRequest> {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? null;
  if (!host) return request;

  const proto = request.headers.get('x-forwarded-proto') ?? 'http';
  const incoming = new URL(request.url);
  const origin = `${proto}://${host}`;
  if (incoming.origin === origin) return request;

  const fixed = new URL(`${origin}${incoming.pathname}${incoming.search}`);
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD' && request.body !== null;
  return new NextRequest(fixed, {
    method: request.method,
    headers: request.headers,
    ...(hasBody ? { body: await request.arrayBuffer() } : {}),
  });
}

export async function GET(request: NextRequest): Promise<Response> {
  return handlers.GET(await withProxyOrigin(request));
}

export async function POST(request: NextRequest): Promise<Response> {
  return handlers.POST(await withProxyOrigin(request));
}
