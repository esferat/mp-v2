import { Inject, Injectable, Module, type OnApplicationBootstrap } from '@nestjs/common';
import { parseEvent, RoutingKeys } from '@mp/contracts';
import { InboxService, LOGGER, type Logger, RabbitService } from '@mp/service-kit';
import {
  SEND_DEPS,
  sendPatientLetter,
  type AppointmentLetterData,
  type Letter,
  type PatientEmailInfo,
  type SendDeps,
} from '../../entities/mail';
import { subscribeNotify } from '../../shared/lib';
import { renderApproved, renderCancelled, renderDeclined } from './template';

type StatusRender = (patient: PatientEmailInfo, data: AppointmentLetterData) => Letter;

/**
 * Письма о статусе записи (6.2: notify-appointment-status).
 *
 * Очередь — по одной на тип события (approved/declined/cancelled): у каждой
 * своя DLQ и свой replay (6.3). Три события делят обработчик и шаблоны;
 * ключи подписки — литералы, чтобы parseEvent сужал тип payload.
 */
@Injectable()
export class NotifyAppointmentStatus implements OnApplicationBootstrap {
  constructor(
    private readonly rabbit: RabbitService,
    private readonly inbox: InboxService,
    @Inject(SEND_DEPS) private readonly deps: SendDeps,
    @Inject(LOGGER) private readonly log: Logger,
  ) {}

  onApplicationBootstrap(): void {
    const common = { rabbit: this.rabbit, inbox: this.inbox, log: this.log };

    subscribeNotify({
      ...common,
      queue: 'q.notification.appointment-approved',
      bindings: [RoutingKeys.AppointmentApproved],
      parse: (event) => parseEvent(RoutingKeys.AppointmentApproved, event.body),
      resolve: (envelope) => this.send(envelope.payload, renderApproved),
    });

    subscribeNotify({
      ...common,
      queue: 'q.notification.appointment-declined',
      bindings: [RoutingKeys.AppointmentDeclined],
      parse: (event) => parseEvent(RoutingKeys.AppointmentDeclined, event.body),
      resolve: (envelope) => this.send(envelope.payload, renderDeclined),
    });

    subscribeNotify({
      ...common,
      queue: 'q.notification.appointment-cancelled',
      bindings: [RoutingKeys.AppointmentCancelled],
      parse: (event) => parseEvent(RoutingKeys.AppointmentCancelled, event.body),
      resolve: (envelope) => this.send(envelope.payload, renderCancelled),
    });
  }

  private async send(data: AppointmentLetterData, render: StatusRender): Promise<string> {
    return sendPatientLetter(this.deps, data.patientId, (patient) => render(patient, data));
  }
}

/** Публичный API слайса (fsd.md S5). */
@Module({
  providers: [NotifyAppointmentStatus],
  exports: [NotifyAppointmentStatus],
})
export class NotifyAppointmentStatusModule {}
