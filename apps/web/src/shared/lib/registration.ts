/**
 * Чистые хелперы auth-маршрутов витрины (без сетевых вызовов — тестируются
 * юнитами).
 *
 * Страницы Keycloak рендерятся на клиенте (тема Keycloakify — SPA), поэтому
 * серверное проксирование разметки форм невозможно: витрина не скрейпит HTML,
 * а отправляет браузер в Keycloak, где форма рисуется штатно.
 */

/**
 * Безопасный callbackUrl: только относительные пути (защита от open redirect,
 * как в 1.1 — AC: внешние URL не принимаются).
 */
export function safeCallbackPath(value: string | null | undefined): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) return value;
  return '/';
}

/**
 * Публичный origin запроса: за nginx/прокси Host — внешний (портал.mp-kit.local),
 * а request.url в контейнере может быть http://0.0.0.0:3000 — тогда абсолютные
 * URL (редиректы) были бы недостижимы из браузера.
 */
export function requestOrigin(headers: Headers): string {
  const forwardedHost = headers.get('x-forwarded-host');
  const host = forwardedHost ?? headers.get('host');
  const proto = headers.get('x-forwarded-proto') ?? 'http';
  return host ? `${proto}://${host}` : 'http://localhost:3000';
}

/**
 * Пометка глубокой ссылки на регистрацию: `/auth/register` отправляет браузер
 * на страницу входа Keycloak с этим параметром — так браузер получает куки
 * сессии (без них форма регистрации отдаёт 400 «Restart login cookie not
 * found»), а тема Keycloakify тут же перебрасывает его на url.registrationUrl
 * (см. packages/keycloak-theme/src/main.tsx).
 *
 * Параметр не является параметром OIDC — Keycloak его игнорирует, но он
 * остаётся в адресной строке браузера.
 */
export const REGISTER_ACTION_PARAM = 'mp_action';
export const REGISTER_ACTION_VALUE = 'register';

/** Дописать пометку регистрации в URL авторизации Keycloak (Query-параметр). */
export function withRegisterAction(authUrl: string): string {
  const url = new URL(authUrl);
  url.searchParams.set(REGISTER_ACTION_PARAM, REGISTER_ACTION_VALUE);
  return url.toString();
}
