import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { applyTraceIdMiddleware, LoggerModule } from '@mp/service-kit';
import { TOKEN_VERIFIER } from '../entities/authorization';
import { JwksTokenVerifier } from '../shared/api';
import { getGatewayEnv, parseAudiences, parseRoles } from '../shared/config';
import { ApiErrorFilter, RequestLogInterceptor } from './kernel';
import { JwtAuthGuard } from '../features/authenticate';
import { AuthorizeModule, RateLimitInterceptor, RolesGuard } from '../features/authorize';
import { HealthFeatureModule } from '../features/health';
import { ProxyModule } from '../features/proxy';

/**
 * Composition root (fsd.md §4.1): только регистрация слайсов и глобальных
 * модулей инфраструктуры. Бизнес-логика здесь не живёт.
 * Окружение валидируется при импорте — старт падает с понятной ошибкой (0.7).
 *
 * Порядок глобальных guard (1.2): сначала JWT (401), потом роли (403);
 * rate-limit interceptor — первым по цепочке ответа (429 до обращения к jwks).
 */
const env = getGatewayEnv();

@Module({
  imports: [
    // Инфраструктура (service-kit)
    LoggerModule.forRoot({ name: 'gateway', level: env.LOG_LEVEL }),
    // Слайсы
    HealthFeatureModule,
    AuthorizeModule,
    ProxyModule,
  ],
  providers: [
    {
      provide: TOKEN_VERIFIER,
      useFactory: () =>
        new JwksTokenVerifier({
          // jwks — по внутреннему адресу контейнера, issuer — публичный (из iss)
          jwksUrl: `${env.KEYCLOAK_INTERNAL_URL}/realms/${env.KEYCLOAK_REALM}/protocol/openid-connect/certs`,
          issuer: `${env.KEYCLOAK_PUBLIC_URL}/realms/${env.KEYCLOAK_REALM}`,
          audiences: parseAudiences(env.AUTH_AUDIENCE),
          defaultRoles: parseRoles(env.AUTH_DEFAULT_ROLES),
        }),
    },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: RateLimitInterceptor },
    // Единый формат ошибок и лог запросов (тесты = прод, 0.7/1.2)
    { provide: APP_FILTER, useClass: ApiErrorFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestLogInterceptor },
  ],
})
export class AppModule implements NestModule {
  /**
   * trace-id middleware живёт здесь, а не в main.ts: единая точка для всех
   * сервисов и для тестов (X-Request-ID → AsyncLocalStorage → pino, 0.10/1.2).
   */
  configure(consumer: MiddlewareConsumer): void {
    applyTraceIdMiddleware(consumer);
  }
}
