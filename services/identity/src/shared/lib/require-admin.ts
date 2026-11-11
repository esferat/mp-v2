import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { RequestAuth } from '@mp/service-kit';

/**
 * Проверка роли ADMIN (защита в глубину): первый рубеж — политика gateway
 * (1.2), здесь — для прямых вызовов сервиса (как в саге 9.1).
 */
export function requireAdmin(auth: RequestAuth | undefined): void {
  if (!auth) throw new UnauthorizedException('Требуется токен доступа');
  if (!auth.realmRoles.includes('ADMIN')) {
    throw new ForbiddenException('Операция доступна только администратору');
  }
}
