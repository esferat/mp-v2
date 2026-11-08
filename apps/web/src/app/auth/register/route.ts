import { NextRequest, NextResponse } from 'next/server';
import { signIn } from '@/shared/config/auth';
import { requestOrigin, safeCallbackPath, withRegisterAction } from '@/shared/lib';

/**
 * Регистрация (1.4/1.1,取代 страницы /auth/signup).
 *
 * Форма регистрации Keycloak доступна только браузеру, уже посетившему
 * страницу авторизации (куки AUTH_SESSION_ID/KC_RESTART, иначе 400), а тема
 * Keycloakify рендерит её на клиенте — поэлементное проксирование разметки
 * невозможно. Поэтому витрина только разводит флоу:
 *
 * 1. Auth.js signIn (redirect:false) ставит куки state/PKCE в ответ браузера
 *    и отдаёт URL авторизации Keycloak — они понадобятся Auth.js на callback
 *    после регистрации.
 * 2. Браузер уходит на страницу входа Keycloak с пометкой mp_action=register:
 *    так он получает куки сессии, без которых форма регистрации недоступна.
 * 3. Тема Keycloakify (packages/keycloak-theme) видит пометку и тут же
 *    перебрасывает на url.registrationUrl — форма открывается без лишних
 *    кликов, дальше пользователь работает напрямую с Keycloak.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = requestOrigin(request.headers);
  const callbackUrl = safeCallbackPath(request.nextUrl.searchParams.get('callbackUrl'));

  try {
    // redirect:false — возвращает URL авторизации Keycloak, куки state/PKCE
    // Auth.js записывает в ответ (cookie store) сам.
    const authUrl = await signIn('keycloak', { redirect: false, redirectTo: callbackUrl });
    return NextResponse.redirect(withRegisterAction(authUrl));
  } catch {
    return NextResponse.redirect(`${origin}/`);
  }
}
