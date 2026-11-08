import { NextRequest, NextResponse } from 'next/server';
import { signIn } from '@/shared/config/auth';
import { requestOrigin, safeCallbackPath } from '@/shared/lib';

/**
 * Редирект входа (1.1,取代 страницы /auth/login): гость с гарда
 * (/auth/login?callbackUrl=…) сразу уходит в Keycloak через Auth.js flow
 * (state + PKCE ставятся в куки ответа) — промежуточного UI больше нет.
 *
 * ?error= — Auth.js присылает сюда при ошибках OAuth (pages.signIn);
 * повторный старт flow зациклил бы ошибку, поэтому уходим на главную.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = requestOrigin(request.headers);

  if (request.nextUrl.searchParams.has('error')) {
    return NextResponse.redirect(`${origin}/`);
  }

  const callbackUrl = safeCallbackPath(request.nextUrl.searchParams.get('callbackUrl'));
  try {
    // redirect:false — возвращает URL авторизации Keycloak, куки state/PKCE
    // Auth.js записывает в ответ (cookie store) сам.
    const authUrl = await signIn('keycloak', { redirect: false, redirectTo: callbackUrl });
    return NextResponse.redirect(authUrl);
  } catch {
    return NextResponse.redirect(`${origin}/`);
  }
}
