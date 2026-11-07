/**
 * Серверные гарды маршрутов (задача 1.3): чистая логика без Next.js —
 * тестируется по каждому сегменту (AC 1.3: unit на каждый сегмент).
 *
 * Гард — ПЕРВЫЙ слой защиты витрины; второй — проверки в server actions,
 * третий — gateway/сервисы (защита в глубину).
 */

export type RequiredRole = 'ADMIN' | 'USER' | 'DOCTOR';

export type RouteDecision =
  /** Маршрут не требует проверки — дальше рендерим. */
  | { type: 'allow' }
  /** Гость → редирект на вход с возвратом (callbackUrl). */
  | { type: 'login'; callbackUrl: string }
  /** Нет роли → страница 403, защищённый контент не отдаётся. */
  | { type: 'forbidden'; required: RequiredRole }
  /** Гость на /auth → оставить; авторизован на /auth → на главную. */
  | { type: 'home' };

/** Защищённые сегменты (functional-spec 1.3). */
const SEGMENT_ROLES: ReadonlyArray<[prefix: string, role: RequiredRole]> = [
  ['/admin/', 'ADMIN'],
  ['/cabinet/', 'USER'],
  ['/doctor/', 'DOCTOR'],
];

/** Роль, требуемая путём; null — маршрут не защищён ролями. */
export function requiredRoleFor(pathname: string): RequiredRole | null {
  for (const [prefix, role] of SEGMENT_ROLES) {
    if (pathname.startsWith(prefix) || pathname === prefix.slice(0, -1)) return role;
  }
  return null;
}

export function isGuestOnlyPath(pathname: string): boolean {
  return pathname === '/auth' || pathname.startsWith('/auth/');
}

/**
 * Решение для запроса: где «стоим», какая роль нужна, есть ли сессия.
 *
 * @param pathname — путь без query
 * @param roles — роли из сессии; `null` — гость (нет сессии)
 */
export function decideAccess(pathname: string, roles: readonly string[] | null): RouteDecision {
  const authenticated = roles !== null;
  const required = requiredRoleFor(pathname);

  if (required) {
    if (!authenticated) return { type: 'login', callbackUrl: pathname };
    if (!roles?.includes(required)) return { type: 'forbidden', required };
    return { type: 'allow' };
  }

  if (isGuestOnlyPath(pathname)) {
    // Залогинен на /auth/login|signup → некуда, ведём на главную (1.3)
    return authenticated ? { type: 'home' } : { type: 'allow' };
  }

  return { type: 'allow' };
}
