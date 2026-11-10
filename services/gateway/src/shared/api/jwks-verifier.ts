import { createRemoteJWKSet, errors as joseErrors, type JWTPayload, jwtVerify } from 'jose';
import {
  type Role,
  ROLES,
  type TokenClaims,
  TokenInvalidError,
  type TokenVerifier,
} from '../../entities/authorization';

export interface JwksVerifierOptions {
  /** Адрес jwks реалма: http://keycloak:8080/realms/<realm>/protocol/openid-connect/certs */
  jwksUrl: string;
  /** Публичный issuer токена: http://localhost:8180/realms/<realm> */
  issuer: string;
  /** Ожидаемые aud (client_id). */
  audiences: string[];
  /** Роли, выдаваемые, если в токене нет известных realm-ролей. */
  defaultRoles: Role[];
}

/**
 * Реализация порта TokenVerifier (1.2): локальная проверка подписи по jwks
 * реалма с кэшем ключей (createRemoteJWKSet: загрузка по kid + ретраи),
 * плюс iss/aud/exp. Сетевых вызовов на каждый запрос нет.
 */
export class JwksTokenVerifier implements TokenVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly options: JwksVerifierOptions) {
    this.jwks = createRemoteJWKSet(new URL(options.jwksUrl), {
      // Ключи ротируются редко — кэш на процесс; cooldown между перезагрузками
      cooldownDuration: 60_000,
      cacheMaxAge: 10 * 60_000,
    });
  }

  async verify(bearerToken: string): Promise<TokenClaims> {
    const token = bearerToken.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      throw new TokenInvalidError('Пустой токен', 'TOKEN_MISSING');
    }

    let payload: JWTPayload;
    try {
      // Аудиорию проверяем сами (ниже): Keycloak в password-grant не ставит aud,
      // а jose с audience-опцией отвергает такие токены. Остаются iss/подпись/exp.
      ({ payload } = await jwtVerify(token, this.jwks, {
        issuer: this.options.issuer,
        clockTolerance: 5,
      }));
    } catch (error) {
      throw mapJoseError(error);
    }

    if (!matchesAudience(payload, this.options.audiences)) {
      throw new TokenInvalidError('Токен для другой аудиории', 'TOKEN_AUDIENCE');
    }

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new TokenInvalidError('В токене нет sub', 'TOKEN_INVALID');
    }

    const realmRoles = extractRoles(payload);
    return {
      sub: payload.sub,
      ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
      // Роли по умолчанию — только если в токене нет ни одной известной
      roles: realmRoles.length > 0 ? realmRoles : this.options.defaultRoles,
      issuer: this.options.issuer,
      expiresAt: new Date((payload.exp ?? 0) * 1000),
    };
  }
}

/** Realm-роли Keycloak → наши роли (пересечение с ROLES, без дублей). */
function extractRoles(payload: JWTPayload): Role[] {
  const realmAccess = payload.realm_access as { roles?: unknown } | undefined;
  const raw = Array.isArray(realmAccess?.roles) ? realmAccess.roles : [];
  const found = new Set<Role>();
  for (const role of raw) {
    if (typeof role === 'string' && (ROLES as readonly string[]).includes(role)) {
      found.add(role as Role);
    }
  }
  return [...found];
}

/**
 * Совпадение аудиории с учётом семантики Keycloak:
 * - `aud` (authorization code / client credentials) — массив или строка;
 * - `azp` (authorized party) — для password-grant, где aud может отсутствовать.
 */
function matchesAudience(payload: JWTPayload, audiences: readonly string[]): boolean {
  const candidates = new Set<string>();
  const aud = payload.aud;
  if (Array.isArray(aud)) aud.forEach((value) => candidates.add(value));
  else if (typeof aud === 'string') candidates.add(aud);
  const azp = (payload as { azp?: unknown }).azp;
  if (typeof azp === 'string') candidates.add(azp);

  return [...candidates].some((value) => audiences.includes(value));
}

/** Ошибки jose → единый TokenInvalidError с кодом для ApiError (401). */
function mapJoseError(error: unknown): TokenInvalidError {
  if (error instanceof joseErrors.JWTExpired) {
    return new TokenInvalidError('Токен просрочен', 'TOKEN_EXPIRED');
  }
  if (error instanceof joseErrors.JWSSignatureVerificationFailed) {
    return new TokenInvalidError('Неверная подпись токена', 'TOKEN_INVALID');
  }
  if (error instanceof joseErrors.JWSInvalid) {
    return new TokenInvalidError('Некорректный токен', 'TOKEN_INVALID');
  }
  if (error instanceof Error && /aud/i.test(error.message)) {
    return new TokenInvalidError('Токен для другой аудиории', 'TOKEN_AUDIENCE');
  }
  if (error instanceof Error && /iss/i.test(error.message)) {
    return new TokenInvalidError('Неверный issuer токена', 'TOKEN_INVALID');
  }
  if (error instanceof Error && /kid|jwks|fetch|network/i.test(error.message)) {
    return new TokenInvalidError('Не удалось получить ключи реалма', 'TOKEN_INVALID');
  }
  return new TokenInvalidError('Токен отклонён', 'TOKEN_INVALID');
}
