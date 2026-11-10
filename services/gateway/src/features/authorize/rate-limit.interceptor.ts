import {
  CallHandler,
  type ExecutionContext,
  HttpException,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { throwError } from 'rxjs';

export const RATE_LIMITERS = Symbol('GatewayRateLimiters');

/** Два лимита: жёсткий на auth, базовый на остальное (1.2). */
export interface RateLimiters {
  auth: { take(key: string): { allowed: boolean; retryAfterSec: number } };
  api: { take(key: string): { allowed: boolean; retryAfterSec: number } };
}

interface RequestLike {
  method: string;
  url: string;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Rate-limit (1.2): in-memory token bucket per IP. 429 — всегда,
 * а не 500 (AC). Ключ — X-Forwarded-For от nginx, иначе IP сокета.
 */
@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(@Inject(RATE_LIMITERS) private readonly limiters: RateLimiters) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<RequestLike>();
    const pathname = request.url.split('?')[0] ?? request.url;

    // Health-эндпоинты не тратят лимит (их дёргает healthcheck контейнера)
    if (pathname === '/healthz' || pathname === '/readyz') return next.handle();

    const key = clientKey(request);
    const isAuth = pathname.startsWith('/api/auth');
    const limiter = isAuth ? this.limiters.auth : this.limiters.api;
    const result = limiter.take(key);

    if (!result.allowed) {
      return throwError(
        () =>
          new HttpException(
            {
              code: 'RATE_LIMITED',
              message: 'Слишком много запросов, попробуйте позже',
              retryAfter: result.retryAfterSec,
            },
            429,
          ),
      );
    }

    return next.handle();
  }
}

function clientKey(request: RequestLike): string {
  const forwarded = request.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (first && first.length > 0) return first.split(',')[0]!.trim();
  return request.ip ?? 'unknown';
}
