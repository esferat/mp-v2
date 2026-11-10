import {
  type DynamicModule,
  Inject,
  Injectable,
  type InjectionToken,
  Module,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { Logger } from 'pino';
import { setOutboxLagSeconds } from '../metrics/metrics.module';
import { LOGGER } from '../logger/logger.module';
import { RabbitService } from './rabbit.service';

/** Статус строки outbox-таблицы. */
export type OutboxStatus = 'PENDING' | 'PUBLISHED' | 'FAILED';

/** Строка outbox-таблицы (модель Prisma описывается в каждом сервисе — см. README). */
export interface OutboxRecord {
  id: string;
  routingKey: string;
  payload: unknown;
  /** Сколько раз публикация уже пыталась выполниться. */
  attempts: number;
  createdAt: Date;
  nextAttemptAt: Date;
}

/**
 * Хранилище outbox. Реализуется поверх Prisma-модели сервиса
 * (createPrismaOutboxStore) — таблица живёт в БД сервиса, поэтому и транзакция
 * бизнес-записи и записи в outbox одна и та же (0.9).
 */
export interface OutboxStore {
  enqueue(routingKey: string, payload: unknown): Promise<void>;

  /** Строки, готовые к отправке (status=PENDING, nextAttemptAt <= now). */
  claim(limit: number): Promise<OutboxRecord[]>;

  /** Пометить пачку опубликованной одним UPDATE (аудит: per-row был ×N). */
  markPublishedMany(ids: string[]): Promise<void>;

  /** retryAt = null → статус FAILED (лимит исчерпан). */
  markFailed(id: string, retryAt: Date | null, error?: string): Promise<void>;
}

export const OUTBOX_STORE = Symbol('MP_OUTBOX_STORE');
export const OUTBOX_OPTIONS = Symbol('MP_OUTBOX_OPTIONS');

export interface OutboxOptions {
  /** Период опроса таблицы, мс. */
  intervalMs: number;
  /** Размер пачки за один проход. */
  batchSize: number;
  /** Максимум попыток до статуса FAILED. */
  maxAttempts: number;
}

export const defaultOutboxOptions: OutboxOptions = {
  intervalMs: 500,
  batchSize: 50,
  maxAttempts: 5,
};

/** Экспоненциальная задержка перед повтором: 1с, 2с, 4с … максимум 60с. */
export function retryDelayMs(attempts: number): number {
  return Math.min(60_000, 1000 * 2 ** attempts);
}

// ------------------------------------------------------------- Prisma-адаптер

/** Минимальный профиль делегата Prisma, которого достаточно адаптеру.
 *  Параметры объявлены как unknown: реальные аргументы Prisma совместимы
 *  с ними (бивариантность методов), а сам адаптер не знает о моделях сервиса. */
export interface PrismaOutboxDelegate {
  create(args: unknown): Promise<unknown>;

  findMany(args: unknown): Promise<unknown>;

  update(args: unknown): Promise<unknown>;

  updateMany(args: unknown): Promise<unknown>;
}

/**
 * Адаптер Prisma-модели OutboxMessage под OutboxStore.
 * Для транзакционной записи передаётся делегат из $transaction:
 *   const store = createPrismaOutboxStore(tx.outboxMessage);
 */
export function createPrismaOutboxStore(delegate: PrismaOutboxDelegate): OutboxStore {
  return {
    async enqueue(routingKey, payload) {
      await delegate.create({
        data: {
          routingKey,
          payload,
          status: 'PENDING',
          attempts: 0,
          nextAttemptAt: new Date(),
        },
      });
    },

    async claim(limit) {
      const rows = await delegate.findMany({
        where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });
      return rows as OutboxRecord[];
    },

    async markPublishedMany(ids) {
      if (ids.length === 0) return;
      await delegate.updateMany({
        where: { id: { in: ids } },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      });
    },

    async markFailed(id, retryAt, error) {
      await delegate.update({
        where: { id },
        data: {
          status: retryAt ? 'PENDING' : 'FAILED',
          attempts: { increment: 1 },
          nextAttemptAt: retryAt ?? new Date(),
          lastError: error?.slice(0, 1000),
        },
      });
    },
  };
}

// ------------------------------------------------------------------ сервисы

/** API записи событий в outbox (вызывается в той же транзакции, что и бизнес-изменение). */
@Injectable()
export class OutboxService {
  constructor(@Inject(OUTBOX_STORE) private readonly store: OutboxStore) {}

  /** Для транзакционной записи: store, привязанный к tx-клиенту. */
  get transactionalStore(): OutboxStore {
    return this.store;
  }

  enqueue(routingKey: string, payload: unknown): Promise<void> {
    return this.store.enqueue(routingKey, payload);
  }
}

/**
 * Релеи публикации (0.9): периодически опрашивает outbox и отправляет
 * PENDING-сообщения в брокер. Один релей на сервис (в compose — один реплика),
 * проходы не пересекаются (флаг running).
 *
 * Оптимизации (аудит): пачка публикуется с ОДНИМ подтверждением и помечается
 * ОДНИМ updateMany (вместо ×N round-trips); пустые проходы уходят в backoff
 * до 30 с — вхолостую таблица не опрашивается каждые 500 мс.
 */
@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopped = false;
  /** Сколько проходов подряд пусто (для backoff). */
  private emptyStreak = 0;

  constructor(
    @Inject(OUTBOX_STORE) private readonly store: OutboxStore,
    private readonly rabbit: RabbitService,
    @Inject(LOGGER) private readonly log: Logger,
    @Inject(OUTBOX_OPTIONS) private readonly options: OutboxOptions,
  ) {}

  onApplicationBootstrap(): void {
    this.scheduleNext(this.options.intervalMs);
  }

  onApplicationShutdown(): void {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Один проход публикации. Вызывается и таймером, и в тестах напрямую. */
  async tick(): Promise<void> {
    if (this.running) return;
    if (!this.rabbit.isReady()) {
      // Брокер недоступен — опрос БД всё равно бессмыслен, а задержку
      // после реконнекта хотим минимальную: streak обнуляем.
      this.emptyStreak = 0;
      return;
    }
    this.running = true;

    try {
      const records = await this.store.claim(this.options.batchSize);
      if (records.length === 0) {
        // пачек нет — лага нет (AC 0.9: метрика отражает текущее состояние)
        setOutboxLagSeconds(0);
        this.emptyStreak += 1;
        return;
      }
      this.emptyStreak = 0;
      // AC 0.9: лаг = возраст старшей записи пачки (сколько событие ждёт публикации)
      const oldest = records
        .map((record) => record.createdAt)
        .reduce((min, createdAt) => (createdAt < min ? createdAt : min));
      setOutboxLagSeconds((Date.now() - oldest.getTime()) / 1000);
      await this.publishBatch(records);
    } catch (error) {
      this.log.error({ err: error }, 'сбой прохода outbox-релея');
    } finally {
      this.running = false;
    }
  }

  /** Вся пачка: один publish-проход → одно подтверждение → один UPDATE. */
  private async publishBatch(records: OutboxRecord[]): Promise<void> {
    try {
      await this.rabbit.publishBatch(
        records.map((record) => ({ routingKey: record.routingKey, payload: record.payload })),
      );
      await this.store.markPublishedMany(records.map((record) => record.id));
      this.log.debug({ count: records.length }, 'пачка событий опубликована');
    } catch (error) {
      // Сбой пачки (связь/брокер): каждая строка получает отложенный повтор
      // со своим счётчиком попыток — семантика at-least-once не меняется.
      for (const record of records) {
        await this.markFailedOne(record, error);
      }
    }
  }

  private async markFailedOne(record: OutboxRecord, error: unknown): Promise<void> {
    const attemptsAfter = record.attempts + 1;
    const exhausted = attemptsAfter >= this.options.maxAttempts;
    const retryAt = exhausted ? null : new Date(Date.now() + retryDelayMs(record.attempts));
    const message = error instanceof Error ? error.message : String(error);

    this.log.warn(
      {
        eventId: record.id,
        routingKey: record.routingKey,
        attempt: attemptsAfter,
        nextRetryAt: retryAt,
      },
      exhausted ? 'лимит попыток исчерпан — событие в FAILED' : 'публикация отложена',
    );

    try {
      await this.store.markFailed(record.id, retryAt, message);
    } catch (storeError) {
      this.log.error({ err: storeError, eventId: record.id }, 'не удалось зафиксировать сбой');
    }
  }

  // --------------------------------------------------------------- таймер

  private scheduleNext(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.tick()
        .catch(() => undefined) // ошибки уже залогированы в tick
        .finally(() => this.scheduleNext(this.nextDelayMs()));
    }, delayMs);
    this.timer.unref?.();
  }

  /**
   * Адаптивный интервал: пока есть сообщения — базовый; пустые проходы
   * удваивают задержку до 30 с (6 сервисов × 2 опроса/сек → ~0.2/сек вхолостую).
   */
  private nextDelayMs(): number {
    if (this.emptyStreak === 0) return this.options.intervalMs;
    return Math.min(this.options.intervalMs * 2 ** this.emptyStreak, 30_000);
  }
}

// -------------------------------------------------------------------- модуль

export interface OutboxModuleOptions {
  store: OutboxStore;
  intervalMs?: number;
  batchSize?: number;
  maxAttempts?: number;
}

export interface OutboxModuleAsyncOptions<TArgs extends unknown[] = unknown[]> {
  /** Зависимости фабрики (например, [PrismaService]). */
  inject?: unknown[];
  /** Возвращает полные опции модуля (включая store, часто — из Prisma-делегата). */
  useFactory: (...args: TArgs) => OutboxModuleOptions | Promise<OutboxModuleOptions>;
}

function resolveOptions(options: OutboxModuleOptions): OutboxOptions {
  return {
    intervalMs: options.intervalMs ?? defaultOutboxOptions.intervalMs,
    batchSize: options.batchSize ?? defaultOutboxOptions.batchSize,
    maxAttempts: options.maxAttempts ?? defaultOutboxOptions.maxAttempts,
  };
}

/**
 * Модуль outbox (0.9). Подключается в app-модуле сервиса:
 *
 *   OutboxModule.forRoot({ store: createPrismaOutboxStore(prisma.outboxMessage) })
 *   // или, когда store зависит от DI-клиента:
 *   OutboxModule.forRootAsync({ inject: [PrismaService],
 *     useFactory: (prisma) => ({ store: createPrismaOutboxStore(prisma.outboxMessage) }) })
 */
@Module({})
export class OutboxModule {
  static forRoot(options: OutboxModuleOptions): DynamicModule {
    return {
      module: OutboxModule,
      global: true,
      providers: [
        { provide: OUTBOX_STORE, useValue: options.store },
        { provide: OUTBOX_OPTIONS, useValue: resolveOptions(options) },
        OutboxService,
        OutboxRelay,
      ],
      exports: [OutboxService, OUTBOX_STORE],
    };
  }

  static forRootAsync<TArgs extends unknown[]>(
    options: OutboxModuleAsyncOptions<TArgs>,
  ): DynamicModule {
    // Nest принимает InjectionToken[]; у нас токены-классы, но объявлено unknown[]
    // ради удобства вызывающего кода (prisma: PrismaService).
    const inject = (options.inject ?? []) as InjectionToken[];

    return {
      module: OutboxModule,
      global: true,
      providers: [
        { provide: OUTBOX_RAW_OPTIONS, useFactory: options.useFactory, inject },
        {
          provide: OUTBOX_STORE,
          useFactory: (raw: OutboxModuleOptions) => raw.store,
          inject: [OUTBOX_RAW_OPTIONS],
        },
        {
          provide: OUTBOX_OPTIONS,
          useFactory: (raw: OutboxModuleOptions) => resolveOptions(raw),
          inject: [OUTBOX_RAW_OPTIONS],
        },
        OutboxService,
        OutboxRelay,
      ],
      exports: [OutboxService, OUTBOX_STORE],
    };
  }
}

/** Внутренний токен: опции, полученные из фабрики forRootAsync. */
const OUTBOX_RAW_OPTIONS = Symbol('MP_OUTBOX_RAW_OPTIONS');
