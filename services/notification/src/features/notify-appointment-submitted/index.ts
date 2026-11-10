import { Inject, Injectable, Module, type OnApplicationBootstrap } from '@nestjs/common';
import { parseEvent, RoutingKeys } from '@mp/contracts';
import { InboxService, LOGGER, type Logger, RabbitService } from '@mp/service-kit';
import {
  SEND_DEPS,
  sendPatientLetter,
  type AppointmentLetterData,
  type SendDeps,
} from '../../entities/mail';
import { subscribeNotify } from '../../shared/lib';
import { renderSubmitted } from './template';

/**
 * Письмо «запись отправлена на подтверждение» (6.2).
 *
 * Адресат резолвится по patientId через patient-service: в событии email нет
 * (PII не денализуется, architecture §6). Сбой patient-service →
 * TransientConsumerError → сообщение возвращается в очередь (без потерь).
 */
@Injectable()
export class NotifyAppointmentSubmitted implements OnApplicationBootstrap {
  constructor(
    private readonly rabbit: RabbitService,
    private readonly inbox: InboxService,
    @Inject(SEND_DEPS) private readonly deps: SendDeps,
    @Inject(LOGGER) private readonly log: Logger,
  ) {}

  onApplicationBootstrap(): void {
    subscribeNotify({
      rabbit: this.rabbit,
      inbox: this.inbox,
      log: this.log,
      queue: 'q.notification.appointment-submitted',
      bindings: [RoutingKeys.AppointmentSubmitted],
      parse: (event) => parseEvent(RoutingKeys.AppointmentSubmitted, event.body),
      resolve: (envelope) => this.send(envelope.payload),
    });
  }

  private async send(data: AppointmentLetterData): Promise<string> {
    return sendPatientLetter(this.deps, data.patientId, (patient) =>
      renderSubmitted(patient, data),
    );
  }
}

/** Публичный API слайса (fsd.md S5). */
@Module({
  providers: [NotifyAppointmentSubmitted],
  exports: [NotifyAppointmentSubmitted],
})
export class NotifyAppointmentSubmittedModule {}
