/**
 * Домен авторизации gateway (1.2): что такое «валидный токен» и «роль».
 * Чистые типы без зависимостей от jose/HTTP — легко тестируются.
 */

/** Realm-роли Keycloak, значимые для портала (functional-spec §2). */
export const ROLES = ['ADMIN', 'USER', 'DOCTOR'] as const;
export type Role = (typeof ROLES)[number];

/** Извлечённые из токена claims. */
export interface TokenClaims {
  /** Keycloak `sub` — стабильный id пользователя. */
  sub: string;
  email?: string;
  /** Известные realm-роли (пересечение с ROLES). */
  roles: Role[];
  /** Нормализованный issuer (без завершающего слэша). */
  issuer: string;
  expiresAt: Date;
}

/** Ошибка проверки токена → 401 (код — из ApiError). */
export class TokenInvalidError extends Error {
  constructor(
    message: string,
    readonly code:
      'TOKEN_MISSING' | 'TOKEN_INVALID' | 'TOKEN_EXPIRED' | 'TOKEN_AUDIENCE' = 'TOKEN_INVALID',
  ) {
    super(message);
    this.name = 'TokenInvalidError';
  }
}

/**
 * Порт проверки токена (hexagonal): реализация — shared/api/jwks-verifier
 * (jwks реалма), в тестах — фейк с готовыми claims.
 */
export interface TokenVerifier {
  /** Бросает TokenInvalidError, если токен невалиден. */
  verify(bearerToken: string): Promise<TokenClaims>;
}

/** DI-токен привязки реализации (сборка — в app/app.module.ts). */
export const TOKEN_VERIFIER = Symbol('GatewayTokenVerifier');
