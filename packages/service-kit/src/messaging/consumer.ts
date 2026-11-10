import type { Logger } from 'pino';
import type { InboxService } from './inbox';
import {
  type ConsumedEvent,
  type EventHandler,
  PermanentConsumerError,
  TransientConsumerError,
} from './rabbit.types';

/**
 * Общая консьюмер-обёртка (6.3): валидация схемы (Zod) → inbox (eventId) →
 * handler → commit; ошибка → ретраи с экспоненциальным backoff → DLQ.
 *
 * Порядок и гарантии:
 *  1. Конверт без eventId — PermanentConsumerError → DLQ (использовать inbox нельзя);
 *  2. `parse` (как правило `parseEvent` из @mp/contracts) — нарушение схемы
 *     НЕ ретраится (яд не лечится повтором) и НЕ трогает inbox → DLQ;
 *  3. `inbox.runOnce(eventId, …)` — повтор события обрабатывается один раз
 *     (AC 6.3 «двойная доставка → один эффект»), фиксация — только после успеха;
 *  4. ошибки handler ретраятся с backoff (`retryDelayMs * 2^(n-1)`), после
 *     исчерпания попыток сообщение уходит в DLQ;
 *  5. TransientConsumerError (SMTP/брокер/сервис недоступны) после ретраев
 *     НЕ уходит в DLQ: RabbitService возвращает сообщение в очередь с
 *     задержкой — копится и доставляется после восстановления (AC 6.2).
 */
export interface ConsumerOptions<T> {
  /** Имя очереди — контекст для логов. */
  queue: string;
  /** Zod-валидация конверта; бросает при расхождении со схемой (→ DLQ). */
  parse: (event: ConsumedEvent) => T;
  /** Бизнес-обработчик уже валидированного события. */
  handler: (payload: T, event: ConsumedEvent) => Promise<void>;
  /** Идемпотентность по eventId (InboxModule подключается глобально в сервисе). */
  inbox: InboxService;
  /** Контекстные логи (ретраи, дубли, исчерпание попыток). */
  log: Logger;
  /** Число попыток обработки (дефолт 3 — 1-я + 2 повтора). */
  maxAttempts?: number;
  /** База backoff ретраев, мс (дефолт 1000 → 1с, 2с, 4с …). */
  retryDelayMs?: number;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Создаёт обработчик очереди по схеме 6.3. Использование:
 *
 *   rabbit.subscribe({
 *     queue: 'q.notification.appointment-submitted',
 *     bindings: [RoutingKeys.AppointmentSubmitted],
 *     handler: createConsumerHandler({ queue, parse, handler, inbox, log }),
 *   });
 */
export function createConsumerHandler<T>(options: ConsumerOptions<T>): EventHandler {
  const {
    queue,
    parse,
    handler,
    inbox,
    log,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  } = options;

  return async (event: ConsumedEvent): Promise<void> => {
    const body = event.body as { eventId?: unknown } | null;
    if (typeof body?.eventId !== 'string' || body.eventId.length === 0) {
      // Без eventId идемпотентность невозможна — яд, повтор не поможет.
      throw new PermanentConsumerError('у события нет eventId (конверт повреждён)');
    }

    let payload: T;
    try {
      payload = parse(event);
    } catch (error) {
      // Нарушение схемы: без ретраев и без записи в inbox → DLQ (playbook 6.3).
      log.warn(
        { err: error, queue, routingKey: event.routingKey },
        'нарушение схемы события — сообщение в DLQ',
      );
      throw error;
    }

    await inbox.runOnce(body.eventId, event.routingKey, () =>
      withRetry(() => handler(payload, event), { queue, log, maxAttempts, retryDelayMs, event }),
    );
  };
}

interface RetryContext {
  queue: string;
  log: Logger;
  maxAttempts: number;
  retryDelayMs: number;
  event: ConsumedEvent;
}

/** Ретраи с экспоненциальным backoff; PermanentConsumerError не ретраится. */
async function withRetry(task: () => Promise<void>, ctx: RetryContext): Promise<void> {
  const { queue, log, maxAttempts, retryDelayMs, event } = ctx;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await task();
      return;
    } catch (error) {
      lastError = error;
      if (error instanceof PermanentConsumerError) throw error;
      if (attempt < maxAttempts) {
        const delay = retryDelayMs * 2 ** (attempt - 1);
        log.warn(
          { err: error, queue, routingKey: event.routingKey, attempt, retryInMs: delay },
          'сбой обработки события — повтор',
        );
        await sleep(delay);
      }
    }
  }

  // Исчерпано: transient → RabbitService вернёт в очередь, остальное → DLQ.
  log.error(
    { err: lastError, queue, routingKey: event.routingKey, attempts: maxAttempts },
    lastError instanceof TransientConsumerError
      ? 'временный сбой не ушёл — сообщение вернётся в очередь'
      : 'лимит попыток исчерпан — сообщение в DLQ',
  );
  throw lastError;
}
