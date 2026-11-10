import { createRemoteJWKSet, errors as joseErrors, type JWTPayload, jwtVerify } from 'jose';

/**
 * Проверка JWT по jwks реалма (защита в глубину, AC 1.2): подписали,
 * iss/aud/exp — сервис принимает запрос. Общий для всех сервисов mp-v2;
 * gateway переиспользует тот же верификатор (домен ролей — его собственный).
 */

/** Ошибка проверки токена → 401 с кодом (маппится ApiErrorFilter'ом). */
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

/** Результат проверки: базовые claims + все realm-роли токена. */
export interface VerifiedToken {
  sub: string;
  email?: string;
  /** Все realm-роли из токена (без фильтра — фильтр делает потребитель). */
  realmRoles: string[];
  issuer: string;
  expiresAt: Date;
}

export interface JwksVerifierOptions {
  /** Адрес jwks: <keycloak>/realms/<realm>/protocol/openid-connect/certs */
  jwksUrl: string;
  /** Публичный issuer (claim iss): <public-url>/realms/<realm>. */
  issuer: string;
  /** Ожидаемые аудиории (client_id через запятую). */
  audiences: string[];
  /** Роли, выдаваемые если в токене нет realm-ролей (редко, для dev). */
  defaultRoles?: string[];
}

export class JwksTokenVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly options: JwksVerifierOptions;

  constructor(options: JwksVerifierOptions) {
    this.options = options;
    this.jwks = createRemoteJWKSet(new URL(options.jwksUrl), {
      cooldownDuration: 60_000,
      cacheMaxAge: 10 * 60_000,
    });
  }

  async verify(bearerToken: string): Promise<VerifiedToken> {
    const token = bearerToken.replace(/^Bearer\s+/i, '').trim();
    if (!token) throw new TokenInvalidError('Пустой токен', 'TOKEN_MISSING');

    let payload: JWTPayload;
    try {
      // Аудиорию проверяем сами: Keycloak в password-grant не ставит aud
      // (jose с audience-опцией отвергает такие токены), работает azp.
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

    const realmRoles = extractRealmRoles(payload);
    return {
      sub: payload.sub,
      ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
      realmRoles: realmRoles.length > 0 ? realmRoles : (this.options.defaultRoles ?? []),
      issuer: this.options.issuer,
      expiresAt: new Date((payload.exp ?? 0) * 1000),
    };
  }
}

function extractRealmRoles(payload: JWTPayload): string[] {
  const realmAccess = payload.realm_access as { roles?: unknown } | undefined;
  if (!Array.isArray(realmAccess?.roles)) return [];
  return realmAccess.roles.filter((role): role is string => typeof role === 'string');
}

/**
 * Аудиория с учётом семантики Keycloak: `aud` (code/client-credentials)
 * или `azp` (password-grant, где aud может отсутствовать).
 */
export function matchesAudience(payload: JWTPayload, audiences: readonly string[]): boolean {
  const candidates = new Set<string>();
  const aud = payload.aud;
  if (Array.isArray(aud)) aud.forEach((value) => candidates.add(value));
  else if (typeof aud === 'string') candidates.add(aud);
  const azp = (payload as { azp?: unknown }).azp;
  if (typeof azp === 'string') candidates.add(azp);

  return [...candidates].some((value) => audiences.includes(value));
}

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
  if (error instanceof Error && /iss/i.test(error.message)) {
    return new TokenInvalidError('Неверный issuer токена', 'TOKEN_INVALID');
  }
  if (error instanceof Error && /kid|jwks|fetch|network|ENOTFOUND|ECONN/i.test(error.message)) {
    return new TokenInvalidError('Не удалось получить ключи реалма', 'TOKEN_INVALID');
  }
  return new TokenInvalidError('Токен отклонён', 'TOKEN_INVALID');
}
