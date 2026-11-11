import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import {
  applyTraceIdMiddleware,
  AuthModule,
  createPrismaOutboxStore,
  JwtAuthGuard,
  LoggerModule,
  OutboxModule,
  RabbitModule,
} from '@mp/service-kit';
import { PrismaService, SharedApiModule } from '../shared/api';
import { ApiErrorFilter, RequestLogInterceptor } from './kernel';
import { getCatalogEnv } from '../shared/config';
import { CreateSpecializationModule } from '../features/create-specialization';
import { DeleteSpecializationModule } from '../features/delete-specialization';
import { GetDoctorsModule } from '../features/get-doctors';
import { GetSpecializationsModule } from '../features/get-specializations';
import { HealthFeatureModule } from '../features/health';
import { CreateDoctorModule } from '../features/create-doctor';
import { UpdateDoctorModule } from '../features/update-doctor';
import { UpdateMyScheduleModule } from '../features/update-my-schedule';
import { GetDoctorModule } from '../features/get-doctor';
import { LinkDoctorUserModule } from '../features/link-doctor-user';
import { SetDoctorPhotoModule } from '../features/set-doctor-photo';

/**
 * Composition root (fsd.md §4.1): только регистрация слайсов и глобальных
 * модулей инфраструктуры. Бизнес-логика здесь не живёт.
 * Окружение валидируется при импорте — старт падает с понятной ошибкой (0.7).
 *
 * Глобальные filter/interceptor регистрируются ЗДЕСЬ (APP_FILTER/APP_INTERCEPTOR),
 * а не в main.ts: иначе тесты не проверяют боевой формат ошибок и логи (0.7 AC).
 */
const env = getCatalogEnv();

@Module({
  imports: [
    // Инфраструктура (service-kit)
    LoggerModule.forRoot({ name: 'catalog', level: env.LOG_LEVEL }),
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
    CreateDoctorModule,
    UpdateDoctorModule,
    UpdateMyScheduleModule,
    GetDoctorModule,
    LinkDoctorUserModule,
    SetDoctorPhotoModule,
    GetSpecializationsModule,
    GetDoctorsModule,
    CreateSpecializationModule,
    DeleteSpecializationModule,
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
