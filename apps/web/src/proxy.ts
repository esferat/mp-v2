import { NextResponse } from 'next/server';
import { auth } from '@/shared/config/auth';
import { decideAccess } from '@/shared/lib';

/**
 * Серверный гард маршрутов (задача 1.3): выполняется ДО рендера страницы.
 *
 * Сессия берётся из HttpOnly-куки (Auth.js JWT); решения — чистая функция
 * decideAccess (покрыта unit-тестами по каждому сегменту).
 *
 * NB: в Next 16 файл называется proxy.ts (middleware.ts устарел).
 */
export default auth((request) => {
  const pathname = request.nextUrl.pathname;

  // Мёртвая сессия: страница пришла с ?expired=1 (refresh не прошёл).
  // Сбрасываем куки и пускаем на вход как гостя — иначе гард видит
  // «живую» JWT-куку, ведёт на главную → раздел → 401 → вход, и редиректы
  // зацикливаются (ERR_TOO_MANY_REDIRECTS). Ключи Auth.js — чанки с префиксом.
  if (pathname === '/auth/login' && request.nextUrl.searchParams.has('expired')) {
    const response = NextResponse.next();
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.includes('authjs.session-token')) {
        response.cookies.delete(cookie.name);
      }
    }
    return response;
  }

  const roles = request.auth?.user.roles ?? null;
  const decision = decideAccess(pathname, roles);

  switch (decision.type) {
    case 'login': {
      // Гость → /auth/login с возвратом после входа (AC 1.3)
      const login = new URL('/auth/login', request.url);
      login.searchParams.set('callbackUrl', decision.callbackUrl);
      return NextResponse.redirect(login);
    }
    case 'forbidden': {
      // Нет роли → 403-страница; защищённый контент не рендерится (AC 1.3)
      return NextResponse.redirect(new URL('/403', request.url));
    }
    case 'home':
      return NextResponse.redirect(new URL('/', request.url));
    case 'allow':
    default:
      return NextResponse.next();
  }
});

export const config = {
  // Только защищаемые сегменты: статика и API не проходят через гард
  matcher: ['/admin/:path*', '/cabinet/:path*', '/doctor/:path*', '/auth/:path*'],
};
