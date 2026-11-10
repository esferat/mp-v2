import {
  type CanActivate,
  type DynamicModule,
  type ExecutionContext,
  HttpException,
  Inject,
  Injectable,
  Module,
} from '@nestjs/common';
import { JwksTokenVerifier, TokenInvalidError, type VerifiedToken } from './jwks-verifier';
import { loadEnv } from '../config/env';

/** Токен проверки токенов (подменяется в тестах). */
export const TOKEN_VERIFIER = Symbol('MP_TOKEN_VERIFIER');

/** Опции guard'а (публичные маршруты). */
export const AUTH_OPTIONS = Symbol('MP_AUTH_OPTIONS');

export interface AuthModuleOptions {
  /**
   * Публичные маршруты сервиса (по префиксу) — без токена.
   * /healthz и /readyz публичны всегда.
   */
  publicPaths?: string[];
}

/** Claims, которые guard кладёт в request.auth. */
export type { VerifiedToken as RequestAuth };

/**
 * Кто запрашивает (распространённый вид claims для доменных проверок
 * прав: file-service, scheduling — единый тип вместо локальных копий, DRY).
 */
export interface AccessSubject {
  sub: string;
  roles: readonly string[];
}

/**
 * Глобальная проверка JWT (1.2, «защита в глубину»): каждый сервис принимает
 * только подписанный токен своего реалма (jwks, iss, aud/azp, exp) — прямой
 * вызов без токена или с чужим токеном → 401. Ролевые проверки — забота
 * gateway (1.2) и доменных сервисов по необходимости.
 *
 * Публичные маршруты: /healthz, /readyz + AUTH_PUBLIC_PATHS сервиса
 * (например, /api/identity/register — регистрация до входа).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_VERIFIER)
    private readonly verifier: { verify(token: string): Promise<VerifiedToken> },
    @Inject(AUTH_OPTIONS) private readonly options: AuthModuleOptions,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      headers: Record<string, string | string[] | undefined>;
      auth?: VerifiedToken;
    }>();

    const path = (request.url.split('?')[0] ?? request.url).replace(/\/$/, '') || '/';

    if (isPublicPath(path, this.options.publicPaths)) return true;

    const header = request.headers.authorization;
    const bearer = Array.isArray(header) ? header[0] : header;
    if (!bearer) {
      throw unauthorized('TOKEN_MISSING', 'Требуется токен доступа');
    }

    try {
      request.auth = await this.verifier.verify(bearer);
      return true;
    } catch (error) {
      if (error instanceof TokenInvalidError) {
        throw unauthorized(error.code, error.message);
      }
      // Прочие сбои (например, jwks недоступен) — не пускаем, но не маскируем
      throw unauthorized('TOKEN_INVALID', 'Токен отклонён');
    }
  }
}

/** Публичность: health-эндпоинты всегда + префиксы из конфига сервиса. */
/**
 * Базовые публичные пути: health-эндпоинты и scrape-эндпоинт метрик —
 * их опрашивают (Prometheus/healthcheck) без токена; остальное — из
 * AUTH_PUBLIC_PATHS сервиса.
 */
export function isPublicPath(path: string, publicPaths: readonly string[] | undefined): boolean {
  if (path === '/healthz' || path === '/readyz' || path === '/metrics') return true;
  return (publicPaths ?? []).some((prefix) => path.startsWith(prefix));
}

/** 401 в едином формате ApiError (маппится ApiErrorFilter'ом сервиса). */
function unauthorized(code: string, message: string): HttpException {
  return new HttpException({ code, message }, 401);
}

/**
 * Модуль аутентификации: подключается один раз в app/app.module.ts сервиса
 * и регистрирует guard:
 *
 *   AuthModule.forRoot({ publicPaths: ['/api/identity/register'] })
 *   { provide: APP_GUARD, useClass: JwtAuthGuard }
 */
@Module({})
export class AuthModule {
  static forRoot(options: AuthModuleOptions = {}): DynamicModule {
    return {
      module: AuthModule,
      global: true,
      providers: [
        {
          provide: AUTH_OPTIONS,
          useFactory: () => {
            // Приоритет: явная опция forRoot → env AUTH_PUBLIC_PATHS
            if (options.publicPaths) return { publicPaths: options.publicPaths };
            const env = loadEnv();
            return {
              publicPaths: env.AUTH_PUBLIC_PATHS.split(',')
                .map((value) => value.trim())
                .filter((value) => value.length > 0),
            };
          },
        },
        {
          provide: TOKEN_VERIFIER,
          useFactory: () => {
            const env = loadEnv();
            return new JwksTokenVerifier({
              jwksUrl: `${env.KEYCLOAK_INTERNAL_URL}/realms/${env.KEYCLOAK_REALM}/protocol/openid-connect/certs`,
              issuer: `${env.KEYCLOAK_PUBLIC_URL}/realms/${env.KEYCLOAK_REALM}`,
              audiences: env.AUTH_AUDIENCE.split(',')
                .map((value) => value.trim())
                .filter((value) => value.length > 0),
            });
          },
        },
      ],
      exports: [TOKEN_VERIFIER, AUTH_OPTIONS],
    };
  }
}
