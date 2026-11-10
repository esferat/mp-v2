import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import {
  applyTraceIdMiddleware,
  AuthModule,
  createPrismaInboxStore,
  createPrismaOutboxStore,
  InboxModule,
  JwtAuthGuard,
  LoggerModule,
  OutboxModule,
  RabbitModule,
} from '@mp/service-kit';
import { PrismaService, SharedApiModule } from '../shared/api';
import { ApiErrorFilter, RequestLogInterceptor } from './kernel';
import { getSchedulingEnv } from '../shared/config';
import { HealthFeatureModule } from '../features/health';
import { ScheduleCopySyncModule } from '../features/schedule-copy-sync';
import { PatientSyncModule } from '../features/patient-sync';
import { GetSpecSlotsModule } from '../features/get-spec-slots';
import { BookAppointmentModule } from '../features/book-appointment';
import { GetAppointmentsModule } from '../features/get-appointments';
import { SetAppointmentStatusModule } from '../features/set-appointment-status';
import { CancelAppointmentModule } from '../features/cancel-appointment';
import { GetMyAppointmentsModule } from '../features/get-my-appointments';
import { EnterVisitResultModule } from '../features/enter-visit-result';
import { VisitResultModule } from '../features/visit-result';
import { GetDoctorAppointmentsModule } from '../features/get-doctor-appointments';
import { GetDoctorPatientsModule } from '../features/get-doctor-patients';
import { CheckRelationModule } from '../features/check-relation';
import { RescheduleAppointmentModule } from '../features/reschedule-appointment';
import { GetDoctorScheduleModule } from '../features/get-doctor-schedule';

/**
 * Composition root (fsd.md §4.1): только регистрация слайсов и глобальных
 * модулей инфраструктуры. Бизнес-логика здесь не живёт.
 * Окружение валидируется при импорте — старт падает с понятной ошибкой (0.7).
 *
 * Глобальные filter/interceptor регистрируются ЗДЕСЬ (APP_FILTER/APP_INTERCEPTOR),
 * а не в main.ts: иначе тесты не проверяют боевой формат ошибок и логи (0.7 AC).
 */
const env = getSchedulingEnv();

@Module({
  imports: [
    // Инфраструктура (service-kit)
    LoggerModule.forRoot({ name: 'scheduling', level: env.LOG_LEVEL }),
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
    // Идемпотентность потребителя doctor.* (5.1/0.9)
    InboxModule.forRootAsync({
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => ({
        store: createPrismaInboxStore(prisma.inboxMessage),
      }),
    }),

    // Слайсы
    HealthFeatureModule,
    ScheduleCopySyncModule,
    PatientSyncModule,
    GetSpecSlotsModule,
    BookAppointmentModule,
    GetAppointmentsModule,
    SetAppointmentStatusModule,
    CancelAppointmentModule,
    GetMyAppointmentsModule,
    EnterVisitResultModule,
    VisitResultModule,
    GetDoctorAppointmentsModule,
    GetDoctorPatientsModule,
    CheckRelationModule,
    RescheduleAppointmentModule,
    GetDoctorScheduleModule,
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
