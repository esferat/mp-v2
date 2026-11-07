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
}

/** Ошибка «брокер недоступен» — outbox ловит её и повторяет позже. */
export class RabbitUnavailableError extends Error {
  constructor(detail: string) {
    super(`RabbitMQ недоступен: ${detail}`);
    this.name = 'RabbitUnavailableError';
  }
}
