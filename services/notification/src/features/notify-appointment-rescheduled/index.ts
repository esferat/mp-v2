import { Inject, Injectable, Module, type OnApplicationBootstrap } from '@nestjs/common';
import { parseEvent, RoutingKeys } from '@mp/contracts';
import { InboxService, LOGGER, type Logger, RabbitService } from '@mp/service-kit';
import { SEND_DEPS, sendPatientLetter, type SendDeps } from '../../entities/mail';
import { subscribeNotify } from '../../shared/lib';
import { renderRescheduled, type RescheduledLetterData } from './template';

/**
 * Письмо «запись перенесена» (6.2: notify-appointment-rescheduled).
 * В payload — старый/новый слот с врачом (10.3), адресат — patientId.
 */
@Injectable()
export class NotifyAppointmentRescheduled implements OnApplicationBootstrap {
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
      queue: 'q.notification.appointment-rescheduled',
      bindings: [RoutingKeys.AppointmentRescheduled],
      parse: (event) => parseEvent(RoutingKeys.AppointmentRescheduled, event.body),
      resolve: (envelope) => this.send(envelope.payload),
    });
  }

  private async send(data: RescheduledLetterData): Promise<string> {
    return sendPatientLetter(this.deps, data.patientId, (patient) =>
      renderRescheduled(patient, data),
    );
  }
}

/** Публичный API слайса (fsd.md S5). */
@Module({
  providers: [NotifyAppointmentRescheduled],
  exports: [NotifyAppointmentRescheduled],
})
export class NotifyAppointmentRescheduledModule {}
