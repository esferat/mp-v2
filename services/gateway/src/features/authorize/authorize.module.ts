import { Module } from '@nestjs/common';
import { getGatewayEnv } from '../../shared/config';
import { InMemoryRateLimiter } from '../../shared/lib';
import { RATE_LIMITERS, type RateLimiters } from './rate-limit.interceptor';

/**
 * Слайс authorize (1.2): роли + rate-limit.
 * Модуль владеет лимитерами (in-memory token bucket на MVP) и предоставляет
 * их глобальному RateLimitInterceptor через APP_INTERCEPTOR в app/app.module.
 */
@Module({
  providers: [
    {
      provide: RATE_LIMITERS,
      useFactory: (): RateLimiters => {
        const env = getGatewayEnv();
        return {
          // Жёсткий лимит на /api/auth/** + базовый на остальное API
          auth: new InMemoryRateLimiter(env.RATE_LIMIT_AUTH, env.RATE_LIMIT_BURST),
          api: new InMemoryRateLimiter(env.RATE_LIMIT_API, env.RATE_LIMIT_BURST),
        };
      },
    },
  ],
  exports: [RATE_LIMITERS],
})
export class AuthorizeModule {}
