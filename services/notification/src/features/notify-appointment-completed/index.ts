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
import { renderCompleted } from './template';

/**
 * Письмо «приём завершён — результаты доступны» (6.2).
 * Событие публикуется при внесении результата приёма (9.2).
 */
@Injectable()
export class NotifyAppointmentCompleted implements OnApplicationBootstrap {
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
      queue: 'q.notification.appointment-completed',
      bindings: [RoutingKeys.AppointmentCompleted],
      parse: (event) => parseEvent(RoutingKeys.AppointmentCompleted, event.body),
      resolve: (envelope) => this.send(envelope.payload),
    });
  }

  private async send(data: AppointmentLetterData): Promise<string> {
    return sendPatientLetter(this.deps, data.patientId, (patient) =>
      renderCompleted(patient, data),
    );
  }
}

/** Публичный API слайса (fsd.md S5). */
@Module({
  providers: [NotifyAppointmentCompleted],
  exports: [NotifyAppointmentCompleted],
})
export class NotifyAppointmentCompletedModule {}
