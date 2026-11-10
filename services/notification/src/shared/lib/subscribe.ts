import {
  createConsumerHandler,
  type ConsumedEvent,
  type InboxService,
  type Logger,
  type RabbitService,
} from '@mp/service-kit';
import { logSendOutcome } from './log';

/**
 * Подписка на очередь уведомлений по пайплайну 6.3: валидация схемы (Zod) →
 * inbox (eventId) → обработчик → ретраи с backoff → DLQ; временные сбои
 * (TransientConsumerError) возвращают сообщение в очередь (6.2).
 *
 * Фича описывает только адресацию — очередь, binding, валидацию и отправку;
 * вся механика доставки переиспользуется и логируется единообразно.
 */
export interface SubscribeNotifyOptions<T> {
  rabbit: RabbitService;
  inbox: InboxService;
  log: Logger;
  /** Имя очереди `q.notification.*` — по одной на тип события (6.2). */
  queue: string;
  /** Routing keys, на которые биндится очередь. */
  bindings: string[];
  /** Zod-валидация конверта → payload (нарушение схемы → DLQ, без ретраев). */
  parse: (event: ConsumedEvent) => T;
  /**
   * Адресация и отправка письма. Возвращает SendOutcome
   * ('sent' | 'skipped' | 'no-recipient') — он логируется обёрткой.
   */
  resolve: (payload: T) => Promise<string>;
}

/** Оформляет подписку очереди с полным пайплайном 6.2/6.3. */
export function subscribeNotify<T>(options: SubscribeNotifyOptions<T>): void {
  const { rabbit, inbox, log, queue, bindings, parse, resolve } = options;

  rabbit.subscribe({
    queue,
    bindings,
    handler: createConsumerHandler({
      queue,
      parse,
      handler: async (payload) => {
        const outcome = await resolve(payload);
        logSendOutcome(log, outcome, { queue });
      },
      inbox,
      log,
    }),
  });
}
