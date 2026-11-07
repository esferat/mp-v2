import {
  CanActivate,
  HttpException,
  Inject,
  Injectable,
  type ExecutionContext,
} from '@nestjs/common';
import { TOKEN_VERIFIER, type TokenClaims, type TokenVerifier } from '../../entities/authorization';
import { findPolicy } from '../../entities/authorization';

/** Профиль HTTP-запроса (без зависимости от типов express). */
interface RequestLike {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  /** Claims выставлены JwtAuthGuard после проверки токена. */
  claims?: TokenClaims;
}

/**
 * Глобальная проверка JWT (1.2): токен по jwks реалма, извлечение claims.
 * Публичные маршруты (policy.roles === null) проходят без токена.
 * Все отказы — 401 в формате ApiError `{code, message, requestId}`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestLike>();
    const policy = findPolicy(request.method, request.url.split('?')[0] ?? request.url);

    // Публичный маршрут (регистрация и т.п.) — токен не обязателен
    if (policy?.roles === null) return true;

    const header = request.headers.authorization;
    const bearer = Array.isArray(header) ? header[0] : header;
    if (!bearer) {
      throw new HttpException({ code: 'UNAUTHORIZED', message: 'Требуется токен доступа' }, 401);
    }

    try {
      request.claims = await this.verifier.verify(bearer);
      return true;
    } catch (error) {
      const code = (error as { code?: string }).code ?? 'TOKEN_INVALID';
      const message = error instanceof Error ? error.message : 'Токен отклонён';
      throw new HttpException({ code, message }, 401);
    }
  }
}
