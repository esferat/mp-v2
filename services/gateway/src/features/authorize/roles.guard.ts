import { CanActivate, ForbiddenException, Injectable, type ExecutionContext } from '@nestjs/common';
import type { TokenClaims } from '../../entities/authorization';
import { findPolicy } from '../../entities/authorization';

/** Профиль HTTP-запроса (без зависимости от типов express). */
interface RequestLike {
  method: string;
  url: string;
  claims?: TokenClaims;
}

/** pathname без query-string и завершающего слэша. */
export function pathnameOf(url: string): string {
  const path = url.split('?')[0] ?? url;
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

/**
 * Проверка ролей по реестру политик маршрутов (1.2): роль есть в токене и
 * подходит политике → иначе 403 `{code, message, requestId}`.
 * Выполняется после JwtAuthGuard (глобальный порядок APP_GUARD).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestLike>();
    const policy = findPolicy(request.method, pathnameOf(request.url));

    // Публичный или не описанный маршрут — ролевая проверка не нужна;
    // для неописанных детали прав проверяет сам сервис (защита в глубину)
    if (!policy || policy.roles === null || policy.roles.length === 0) return true;

    const roles = request.claims?.roles ?? [];
    const allowed = roles.some((role) => policy.roles?.includes(role));
    if (!allowed) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Маршрут требует роль: ${policy.roles.join(' или ')}`,
      });
    }
    return true;
  }
}
