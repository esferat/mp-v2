import { Inject, Injectable, Module, type OnApplicationBootstrap } from '@nestjs/common';
import { parseEvent, RoutingKeys } from '@mp/contracts';
import { InboxService, LOGGER, type Logger, RabbitService } from '@mp/service-kit';
import { SEND_DEPS, sendPatientLetter, type SendDeps } from '../../entities/mail';
import { subscribeNotify } from '../../shared/lib';
import { renderDocumentUploaded, type DocumentUploadedLetterData } from './template';

/**
 * Письмо «вам загружен документ» (6.2: notify-document-uploaded).
 *
 * Адресат — владелец файла; условие «если загрузил не он сам» (спека) —
 * сравнение uploadedBy (sub загрузившего) с userId владельца, а не с ownerId:
 * ownerId для PATIENT-файлов — это patientId, а uploadedBy — userId, это
 * разные пространства идентификаторов.
 *
 * Владелец-DOCTOR: email врачей появляется в catalog с 10.2 — до тех пор
 * письмо пропускается (log), чтобы не слать на несуществующий адрес.
 */
@Injectable()
export class NotifyDocumentUploaded implements OnApplicationBootstrap {
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
      queue: 'q.notification.document-uploaded',
      bindings: [RoutingKeys.DocumentUploaded],
      parse: (event) => parseEvent(RoutingKeys.DocumentUploaded, event.body),
      resolve: (envelope) => this.send(envelope.payload),
    });
  }

  private async send(data: DocumentUploadedLetterData): Promise<string> {
    if (data.ownerType !== 'PATIENT') {
      // 10.2: email врачей ещё не в catalog — адресата нет, письмо не шлём.
      this.log.info(
        { key: data.key, ownerType: data.ownerType },
        'владелец-врач: email неизвестен (10.2) — письмо пропущено',
      );
      return 'skipped';
    }

    return sendPatientLetter(
      this.deps,
      data.ownerId,
      (owner) => renderDocumentUploaded(owner, data),
      { uploadedBy: data.uploadedBy },
    );
  }
}

/** Публичный API слайса (fsd.md S5). */
@Module({
  providers: [NotifyDocumentUploaded],
  exports: [NotifyDocumentUploaded],
})
export class NotifyDocumentUploadedModule {}
