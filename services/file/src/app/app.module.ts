import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import {
  applyTraceIdMiddleware,
  AuthModule,
  JwtAuthGuard,
  LoggerModule,
  RabbitModule,
  OutboxModule,
  createPrismaOutboxStore,
} from '@mp/service-kit';
import { PrismaService, SharedApiModule } from '../shared/api';
import { ApiErrorFilter, RequestLogInterceptor } from './kernel';
import { getFileEnv } from '../shared/config';
import { HealthFeatureModule } from '../features/health';
import { UploadFileModule } from '../features/upload-file';
import { DeleteFileModule } from '../features/delete-file';
import { GetFileLinkModule } from '../features/get-file-link';
import { ListFilesModule } from '../features/list-files';

/**
 * Composition root (fsd.md §4.1): только регистрация слайсов и глобальных
 * модулей инфраструктуры. Бизнес-логика здесь не живёт.
 * Окружение валидируется при импорте — старт падает с понятной ошибкой (0.7).
 *
 * Глобальные filter/interceptor регистрируются ЗДЕСЬ (APP_FILTER/APP_INTERCEPTOR),
 * а не в main.ts: иначе тесты не проверяют боевой формат ошибок и логи (0.7 AC).
 */
const env = getFileEnv();

@Module({
  imports: [
    // Инфраструктура (service-kit)
    LoggerModule.forRoot({ name: 'file', level: env.LOG_LEVEL }),
    AuthModule.forRoot(),
    RabbitModule.forRoot({
      url: env.RABBITMQ_URL,
      exchange: env.RABBITMQ_EXCHANGE,
      dlxExchange: env.RABBITMQ_DLX_EXCHANGE,
      prefetch: env.RABBITMQ_PREFETCH,
    }),
    OutboxModule.forRootAsync({
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => ({
        // Событие пишется в той же транзакции, что и изменение (0.9)
        store: createPrismaOutboxStore(prisma.outboxMessage),
        intervalMs: env.OUTBOX_INTERVAL_MS,
        batchSize: env.OUTBOX_BATCH_SIZE,
        maxAttempts: env.OUTBOX_MAX_ATTEMPTS,
      }),
    }),
    SharedApiModule.forRoot(),

    // Слайсы
    HealthFeatureModule,
    UploadFileModule,
    DeleteFileModule,
    GetFileLinkModule,
    ListFilesModule,
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
