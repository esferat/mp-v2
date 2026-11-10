import type { ConsumeMessage } from 'amqplib';

/** Конфигурация подключения к брокеру (заполняется из окружения). */
export interface RabbitConfig {
  url: string;
  /** Topic-exchange событий. */
  exchange: string;
  /** Dead-letter exchange для сообщений с ошибкой обработки. */
  dlxExchange: string;
  /** Максимум необработанных сообщений на consumer. */
  prefetch: number;
}

/** Сообщение, передаваемое в обработчик. */
export interface ConsumedEvent {
  routingKey: string;
  /** Распарсенный JSON полезной нагрузки (конверт события). */
  body: unknown;
  raw: ConsumeMessage;
}

/** Обработчик сообщений: исключение → nack без requeue → DLQ. */
export type EventHandler = (event: ConsumedEvent) => Promise<void>;

/** Описание очереди и её подписок (объявляются идемпотентно при старте). */
export interface QueueSubscription {
  /** Имя очереди (стабильное, уникальное в рамках сервиса). */
  queue: string;
  /** Routing keys, по которым сообщения попадают в очередь. */
  bindings: string[];
  handler: EventHandler;
  /**
   * Задержка перед возвратом сообщения в очередь при TransientConsumerError
   * (6.3: временный сбой внешней зависимости — SMTP/брокер/сервис недоступны;
   * сообщение копится в очереди и доставляется после восстановления, без потерь).
   * Дефолт — 5 с.
   */
  requeueDelayMs?: number;
}

/**
 * Временный сбой внешней зависимости (6.2/6.3): SMTP, patient-service и т.п.
 * Обработчик кидает его — сообщение НЕ уходит в DLQ, а возвращается в очередь
 * с задержкой (AC 6.2 «падение SMTP → сообщения копятся и доставляются
 * после восстановления, без потерь»).
 */
export class TransientConsumerError extends Error {
  constructor(detail: string) {
    super(`Временный сбой обработки: ${detail}`);
    this.name = 'TransientConsumerError';
  }
}

/**
 * Постоянная ошибка обработки (6.3): сообщение уходит в DLQ сразу, без ретраев —
 * повтор бессмыслен (например, грубое нарушение бизнес-правила). Без этого
 * класса дефолтное поведение обработчика — ретраи с backoff → DLQ.
 */
export class PermanentConsumerError extends Error {
  constructor(detail: string) {
    super(`Постоянный сбой обработки: ${detail}`);
    this.name = 'PermanentConsumerError';
  }
}

/** Ошибка «брокер недоступен» — outbox ловит её и повторяет позже. */
export class RabbitUnavailableError extends Error {
  constructor(detail: string) {
    super(`RabbitMQ недоступен: ${detail}`);
    this.name = 'RabbitUnavailableError';
  }
}
