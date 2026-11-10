import { Inject, Injectable, Module, type OnApplicationBootstrap } from '@nestjs/common';
import { parseEvent, RoutingKeys } from '@mp/contracts';
import { InboxService, LOGGER, type Logger, RabbitService } from '@mp/service-kit';
import { SEND_DEPS, sendLetter, type SendDeps } from '../../entities/mail';
import { subscribeNotify } from '../../shared/lib';
import { renderUserRegistered } from './template';

/**
 * Приветствие после регистрации (6.2: notify-user-registered).
 *
 * Канал не дублируется с Keycloak: `user.registered.v1` публикуется только
 * сагой самостоятельной регистрации пациента — при создании врача админом
 * письмо шлёт Keycloak (invite, 10.2), событие не публикуется.
 *
 * Адресат — email из payload (HTTP-резолв не нужен).
 */
@Injectable()
export class NotifyUserRegistered implements OnApplicationBootstrap {
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
      queue: 'q.notification.user-registered',
      bindings: [RoutingKeys.UserRegistered],
      parse: (event) => parseEvent(RoutingKeys.UserRegistered, event.body),
      resolve: (envelope) => sendLetter(this.deps, renderUserRegistered(envelope.payload.email)),
    });
  }
}

/** Публичный API слайса (fsd.md S5). */
@Module({
  providers: [NotifyUserRegistered],
  exports: [NotifyUserRegistered],
})
export class NotifyUserRegisteredModule {}
