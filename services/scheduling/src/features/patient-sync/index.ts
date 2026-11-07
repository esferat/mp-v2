import { Inject, Injectable, Module, type OnApplicationBootstrap } from '@nestjs/common';
import { RoutingKeys } from '@mp/contracts';
import {
  InboxService,
  LOGGER,
  RabbitService,
  type ConsumedEvent,
  type Logger,
} from '@mp/service-kit';
import { APPOINTMENT_REPOSITORY, type AppointmentRepository } from '../../entities/appointment';
import { applyPatientEvent } from './app/apply-patient-event';

/**
 * Потребитель patient.* (4.6): обновляет ФИО пациента в записях —
 * списки/история показывают текущее имя (правило — в app/apply-patient-event).
 * Идемпотентность: InboxService.runOnce по eventId + безвредность повтора
 * самого обновления (AC 4.6: повтор события не создаёт дублей).
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
      handler: (event) => this.handle(event),
    });
  }

  private async handle(event: ConsumedEvent): Promise<void> {
    const body = event.body as { eventId?: string };
    if (!body?.eventId) {
      throw new Error('у события нет eventId (конверт повреждён) — в DLQ');
    }
    const result = await this.inbox.runOnce(body.eventId, event.routingKey, () =>
      applyPatientEvent(this.appointments, event),
    );
    if (result.executed && result.result && result.result.updated > 0) {
      this.log.debug({ updated: result.result.updated }, 'ФИО пациента обновлено в записях (4.6)');
    }
  }
}

/** Публичный API слайса (fsd.md S5): денализация ФИО пациента (4.6). */
@Module({
  providers: [PatientSync],
  exports: [PatientSync],
})
export class PatientSyncModule {}
