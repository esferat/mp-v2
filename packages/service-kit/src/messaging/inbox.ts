import {
  Inject,
  Injectable,
  Module,
  type DynamicModule,
  type InjectionToken,
} from '@nestjs/common';
import type { Logger } from 'pino';
import { LOGGER } from '../logger/logger.module';

/**
 * Хранилище inbox (0.9): messageId → факт обработки. Статус сообщения —
 * idempotency-key потребителя; повторная доставка не приводит к повторному эффекту.
 */
export interface InboxStore {
  /** Уже обработано? */
  has(messageId: string): Promise<boolean>;
  /** Зафиксировать обработку. Дубликат (уникальный индекс) — не ошибка. */
  add(messageId: string, routingKey: string): Promise<void>;
}

export const INBOX_STORE = Symbol('MP_INBOX_STORE');

/** Минимальный профиль делегата Prisma для inbox-модели (см. PrismaOutboxDelegate). */
export interface PrismaInboxDelegate {
  findUnique(args: unknown): Promise<unknown>;
  create(args: unknown): Promise<unknown>;
}

/** Адаптер Prisma-модели InboxMessage под InboxStore. */
export function createPrismaInboxStore(delegate: PrismaInboxDelegate): InboxStore {
  return {
    async has(messageId) {
      const row = await delegate.findUnique({ where: { messageId } });
      return row !== null;
    },
    async add(messageId, routingKey) {
      await delegate.create({ data: { messageId, routingKey } });
    },
  };
}

/**
 * Гарант идемпотентности обработчика: выполняет fn ровно один раз на messageId.
 *
 * Схема: сначала проверка has → выполнение → фиксация в inbox.
 * Дубликат фиксации (уникальный индекс, гонка параллельных потребителей)
 * подавляется — сообщение уже обработано, повторный эффект не нужен.
 */
@Injectable()
export class InboxService {
  constructor(
    @Inject(INBOX_STORE) private readonly store: InboxStore,
    @Inject(LOGGER) private readonly log: Logger,
  ) {}

  async runOnce<T>(
    messageId: string,
    routingKey: string,
    handler: () => Promise<T>,
  ): Promise<{ executed: boolean; result?: T }> {
    if (await this.store.has(messageId)) {
      this.log.debug({ messageId, routingKey }, 'дубликат — пропуск обработки');
      return { executed: false };
    }

    const result = await handler();

    try {
      await this.store.add(messageId, routingKey);
    } catch (error) {
      // Уникальный индекс: параллельный потребитель успел первым — считаем обработанным.
      this.log.debug({ messageId, err: error }, 'сообщение уже зафиксировано другим потребителем');
    }

    return { executed: true, result };
  }
}

export interface InboxModuleOptions {
  store: InboxStore;
}

/** Асинхронные опции (зеркало OutboxModule.forRootAsync): store из DI-клиента. */
export interface InboxModuleAsyncOptions<TArgs extends unknown[] = unknown[]> {
  /** Зависимости фабрики (например, [PrismaService]). */
  inject?: unknown[];
  /** Возвращает опции модуля (store — часто из Prisma-делегата). */
  useFactory: (...args: TArgs) => InboxModuleOptions | Promise<InboxModuleOptions>;
}

const INBOX_RAW_OPTIONS = Symbol('MP_INBOX_RAW_OPTIONS');

/**
 * Модуль inbox (0.9): InboxModule.forRoot({ store: createPrismaInboxStore(prisma.inboxMessage) })
 * или forRootAsync({ inject: [PrismaService],
 *   useFactory: (prisma) => ({ store: createPrismaInboxStore(prisma.inboxMessage) }) }).
 */
@Module({})
export class InboxModule {
  static forRoot(options: InboxModuleOptions): DynamicModule {
    return {
      module: InboxModule,
      global: true,
      providers: [{ provide: INBOX_STORE, useValue: options.store }, InboxService],
      exports: [InboxService, INBOX_STORE],
    };
  }

  static forRootAsync<TArgs extends unknown[]>(
    options: InboxModuleAsyncOptions<TArgs>,
  ): DynamicModule {
    const inject = (options.inject ?? []) as InjectionToken[];

    return {
      module: InboxModule,
      global: true,
      providers: [
        { provide: INBOX_RAW_OPTIONS, useFactory: options.useFactory, inject },
        {
          provide: INBOX_STORE,
          useFactory: (raw: InboxModuleOptions) => raw.store,
          inject: [INBOX_RAW_OPTIONS],
        },
        InboxService,
      ],
      exports: [InboxService, INBOX_STORE],
    };
  }
}
