import { Inject, Injectable, Module, type OnApplicationBootstrap } from '@nestjs/common';
import { RoutingKeys } from '@mp/contracts';
import {
  createConsumerHandler,
  InboxService,
  LOGGER,
  type Logger,
  RabbitService,
} from '@mp/service-kit';
import { APPOINTMENT_REPOSITORY, type AppointmentRepository } from '../../entities/appointment';
import { applyPatientEvent, parsePatientEvent } from './app/apply-patient-event';

/**
 * Потребитель patient.* (4.6): обновляет ФИО пациента в записях —
 * списки/история показывают текущее имя (правило — в app/apply-patient-event).
 *
 * Подключение к очереди и весь пайплайн 6.3 (валидация Zod → inbox по eventId
 * → обработчик → ретраи с backoff → DLQ) даёт общая обёртка
 * createConsumerHandler из service-kit — слайс описывает только parse/handler.
 *
 * InboxModule подключается глобально из app/app.module.ts (forRootAsync).
 */
@Injectable()
export class PatientSync implements OnApplicationBootstrap {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointments: AppointmentRepository,
    private readonly inbox: InboxService,
    private readonly rabbit: RabbitService,
    @Inject(LOGGER)
    private readonly log: Logger,
  ) {}

  onApplicationBootstrap(): void {
    this.rabbit.subscribe({
      queue: 'scheduling.patient-sync',
      bindings: [RoutingKeys.PatientCreated, RoutingKeys.PatientUpdated],
      handler: createConsumerHandler({
        queue: 'scheduling.patient-sync',
        parse: (event) => parsePatientEvent(event.routingKey, event.body),
        handler: async (envelope, event) => {
          const { updated } = await applyPatientEvent(this.appointments, envelope);
          if (updated > 0) {
            this.log.debug(
              { updated, routingKey: event.routingKey },
              'ФИО пациента обновлено в записях (4.6)',
            );
          }
        },
        inbox: this.inbox,
        log: this.log,
      }),
    });
  }
}

/** Публичный API слайса (fsd.md S5): денализация ФИО пациента (4.6). */
@Module({
  providers: [PatientSync],
  exports: [PatientSync],
})
export class PatientSyncModule {}
