import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { {{KIT_IMPORTS}} } from '@mp/service-kit';
{{SHARED_API_IMPORT}}import { ApiErrorFilter, RequestLogInterceptor } from './kernel';
import { get{{CAP}}Env } from '../shared/config';
import { HealthFeatureModule } from '../features/health';

/**
 * Composition root (fsd.md §4.1): только регистрация слайсов и глобальных
 * модулей инфраструктуры. Бизнес-логика здесь не живёт.
 * Окружение валидируется при импорте — старт падает с понятной ошибкой (0.7).
 *
 * Глобальные filter/interceptor регистрируются ЗДЕСЬ (APP_FILTER/APP_INTERCEPTOR),
 * а не в main.ts: иначе тесты не проверяют боевой формат ошибок и логи (0.7 AC).
 * AuthModule + JwtAuthGuard — защита в глубину (1.2): прямой вызов без токена → 401;
 * публичные маршруты — /healthz, /readyz + AUTH_PUBLIC_PATHS (env).
 */
const env = get{{CAP}}Env();

@Module({
  imports: [
    // Инфраструктура (service-kit)
    LoggerModule.forRoot({ name: '{{NAME}}', level: env.LOG_LEVEL }),
    AuthModule.forRoot(),{{MODULE_IMPORTS}}
    // Слайсы
    HealthFeatureModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
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
