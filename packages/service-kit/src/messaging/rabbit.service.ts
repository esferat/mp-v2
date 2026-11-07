import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import {
  connect,
  type Channel,
  type ChannelModel,
  type ConfirmChannel,
  type ConsumeMessage,
} from 'amqplib';
import type { Logger } from 'pino';
import { LOGGER } from '../logger/logger.module';
import {
  RabbitUnavailableError,
  type ConsumedEvent,
  type QueueSubscription,
  type RabbitConfig,
} from './rabbit.types';

export const RABBIT_CONFIG = Symbol('MP_RABBIT_CONFIG');

const RECONNECT_DELAY_MS = 5000;

/**
 * Клиент RabbitMQ (0.9): один коннект на сервис, topology (exchange/очереди/DLQ)
 * объявляется идемпотентно, подписки восстанавливаются после переподключения.
 *
 * Используется двумя путями:
 *  - напрямую — publish событий «в обход» outbox (только для best-effort);
 *  - из OutboxRelay — штатный путь публикации изменений.
 */
@Injectable()
export class RabbitService implements OnApplicationBootstrap, OnApplicationShutdown {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private confirmChannel: ConfirmChannel | null = null;
  private readonly subscriptions: QueueSubscription[] = [];
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connecting = false;
  private stopped = false;

  constructor(
    @Inject(RABBIT_CONFIG) private readonly config: RabbitConfig,
    @Inject(LOGGER) private readonly log: Logger,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Брокер может подниматься дольше сервиса: не валем процесс, а ретраимся.
    await this.connectWithRetry();
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      await this.connection?.close();
    } catch (error) {
      this.log.warn({ err: error }, 'ошибка закрытия соединения RabbitMQ');
    }
    this.connection = null;
    this.channel = null;
    this.confirmChannel = null;
  }

  /** Готов ли брокер к публикации (проверяется outbox перед отправкой). */
  isReady(): boolean {
    return this.confirmChannel !== null;
  }

  /** Подписка на очередь. Можно вызывать до или после подключения к брокеру. */
  subscribe(subscription: QueueSubscription): void {
    this.subscriptions.push(subscription);
    if (this.channel) {
      void this.declareAndConsume(subscription).catch((error: unknown) => {
        this.log.error({ err: error, queue: subscription.queue }, 'ошибка подписки');
      });
    }
  }

  /**
   * Публикация в topic-exchange (confirm-channel, persistent).
   * Бросает RabbitUnavailableError, если брокер недоступен — вызывающий (outbox) повторит.
   */
  async publish(routingKey: string, message: unknown): Promise<void> {
    await this.publishBatch([{ routingKey, payload: message }]);
  }

  /**
   * Публикация пачки с ОДНИМ подтверждением (аудит 0.9): раньше каждое
   * сообщение ждало waitForConfirms отдельно — батч из 50 стоил 50 RTT.
   * Сериализация всей пачки до отправки: ошибка одного payload не должна
   * оставить наполовину опубликованную пачку без подтверждения.
   */
  async publishBatch(messages: readonly { routingKey: string; payload: unknown }[]): Promise<void> {
    if (messages.length === 0) return;

    const channel = this.confirmChannel;
    if (!channel) {
      throw new RabbitUnavailableError('соединение не установлено');
    }

    const prepared = messages.map(({ routingKey, payload }) => ({
      routingKey,
      content: Buffer.from(JSON.stringify(payload), 'utf8'),
      messageId: extractMessageId(payload),
    }));

    for (const { routingKey, content, messageId } of prepared) {
      channel.publish(this.config.exchange, routingKey, content, {
        persistent: true,
        contentType: 'application/json',
        ...(messageId ? { messageId } : {}),
      });
    }
    await channel.waitForConfirms();
  }

  // ---------------------------------------------------------------- internals

  private async connectWithRetry(): Promise<void> {
    if (this.stopped || this.connecting) return;
    this.connecting = true;

    try {
      const connection = await connect(this.config.url);

      connection.on('error', (error: unknown) => {
        this.log.error({ err: error }, 'ошибка соединения RabbitMQ');
      });
      connection.on('close', () => {
        this.connection = null;
        this.channel = null;
        this.confirmChannel = null;
        if (!this.stopped) {
          this.log.warn('соединение RabbitMQ закрыто — переподключение');
          this.scheduleReconnect();
        }
      });

      const channel = await connection.createChannel();
      const confirmChannel = await connection.createConfirmChannel();

      for (const ch of [channel, confirmChannel]) {
        ch.on('error', (error: unknown) =>
          this.log.error({ err: error }, 'ошибка канала RabbitMQ'),
        );
      }

      await channel.prefetch(this.config.prefetch);
      await this.assertTopology(channel);

      this.connection = connection;
      this.channel = channel;
      this.confirmChannel = confirmChannel;

      for (const subscription of this.subscriptions) {
        await this.declareAndConsume(subscription);
      }

      this.log.info(
        { exchange: this.config.exchange, queues: this.subscriptions.map((s) => s.queue) },
        'подключено к RabbitMQ',
      );
    } catch (error) {
      this.log.warn(
        { err: error, retryInMs: RECONNECT_DELAY_MS },
        'не удалось подключиться к RabbitMQ',
      );
      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connectWithRetry();
    }, RECONNECT_DELAY_MS);
    this.reconnectTimer.unref?.();
  }

  private async assertTopology(channel: Channel): Promise<void> {
    await channel.assertExchange(this.config.exchange, 'topic', { durable: true });
    await channel.assertExchange(this.config.dlxExchange, 'direct', { durable: true });
  }

  private async declareAndConsume(subscription: QueueSubscription): Promise<void> {
    const channel = this.channel;
    if (!channel) return;

    const { queue } = subscription;
    const dlq = `${queue}.dlq`;

    // Сообщение с ошибкой обработки уходит в DLQ, а не теряется и не крутится в цикле.
    await channel.assertQueue(queue, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': this.config.dlxExchange,
        'x-dead-letter-routing-key': queue,
      },
    });
    await channel.assertQueue(dlq, { durable: true });
    await channel.bindQueue(dlq, this.config.dlxExchange, queue);

    for (const key of subscription.bindings) {
      await channel.bindQueue(queue, this.config.exchange, key);
    }

    await channel.consume(
      queue,
      (message) => {
        if (message) void this.dispatch(subscription, message);
      },
      { noAck: false },
    );

    this.log.info({ queue, bindings: subscription.bindings }, 'подписка на очередь оформлена');
  }

  private async dispatch(subscription: QueueSubscription, message: ConsumeMessage): Promise<void> {
    const channel = this.channel;
    let body: unknown;

    try {
      body = JSON.parse(message.content.toString('utf8'));
    } catch (error) {
      this.log.error(
        { err: error, queue: subscription.queue },
        'некорректный JSON — сообщение в DLQ',
      );
      this.nack(channel, message);
      return;
    }

    const event: ConsumedEvent = {
      routingKey: message.fields.routingKey,
      body,
      raw: message,
    };

    try {
      await subscription.handler(event);
      channel?.ack(message);
    } catch (error) {
      // Идемпотентность — забота потребителя (inbox); сюда попадает только сбой.
      this.log.error(
        { err: error, queue: subscription.queue, routingKey: event.routingKey },
        'обработчик упал — сообщение в DLQ',
      );
      this.nack(channel, message);
    }
  }

  private nack(channel: Channel | null, message: ConsumeMessage): void {
    try {
      channel?.nack(message, false, false);
    } catch (error) {
      this.log.warn({ err: error }, 'не удалось отправить сообщение в DLQ');
    }
  }
}

/** messageId конверта события — по нему работает inbox-дедупликация. */
function extractMessageId(message: unknown): string | undefined {
  if (typeof message === 'object' && message !== null && 'eventId' in message) {
    const value = (message as { eventId?: unknown }).eventId;
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}
