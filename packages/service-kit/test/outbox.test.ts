import { describe, expect, it } from 'vitest';
import {
  OutboxRelay,
  OutboxService,
  createPrismaOutboxStore,
  retryDelayMs,
  type OutboxRecord,
  type OutboxStore,
} from '../src/messaging/outbox';
import type { RabbitService } from '../src/messaging/rabbit.service';

// ------------------------------------------------------------------ фейки

interface StoredRow extends OutboxRecord {
  status: 'PENDING' | 'PUBLISHED' | 'FAILED';
  lastError?: string;
  publishedAt?: Date;
}

class FakeStore implements OutboxStore {
  rows: StoredRow[] = [];
  claimCalls = 0;
  private seq = 0;

  async enqueue(routingKey: string, payload: unknown): Promise<void> {
    this.rows.push({
      id: `id-${++this.seq}`,
      routingKey,
      payload,
      attempts: 0,
      createdAt: new Date(),
      nextAttemptAt: new Date(Date.now() - 1000),
      status: 'PENDING',
    });
  }

  async claim(limit: number): Promise<OutboxRecord[]> {
    this.claimCalls += 1;
    return this.rows
      .filter((row) => row.status === 'PENDING' && row.nextAttemptAt <= new Date())
      .slice(0, limit)
      .map((row) => ({
        id: row.id,
        routingKey: row.routingKey,
        payload: row.payload,
        attempts: row.attempts,
        createdAt: row.createdAt,
        nextAttemptAt: row.nextAttemptAt,
      }));
  }

  async markPublishedMany(ids: string[]): Promise<void> {
    for (const id of ids) {
      const row = this.mustFind(id);
      row.status = 'PUBLISHED';
      row.publishedAt = new Date();
    }
  }

  async markFailed(id: string, retryAt: Date | null, error?: string): Promise<void> {
    const row = this.mustFind(id);
    row.attempts += 1;
    row.lastError = error;
    row.status = retryAt ? 'PENDING' : 'FAILED';
    row.nextAttemptAt = retryAt ?? new Date();
  }

  private mustFind(id: string): StoredRow {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new Error(`нет строки ${id}`);
    return row;
  }
}

class FakeRabbit {
  ready = true;
  published: { routingKey: string; message: unknown }[] = [];
  failTimes = 0;

  isReady(): boolean {
    return this.ready;
  }

  async publishBatch(messages: readonly { routingKey: string; payload: unknown }[]): Promise<void> {
    if (this.failTimes > 0) {
      this.failTimes -= 1;
      throw new Error('broker down');
    }
    for (const { routingKey, payload } of messages) {
      this.published.push({ routingKey, message: payload });
    }
  }
}

const silentLog = {
  trace() {},
  debug() {},
  info() {},
  warn() {},
  error() {},
  fatal() {},
};

function makeRelay(
  store: FakeStore,
  rabbit: FakeRabbit,
  overrides: Partial<{ intervalMs: number; batchSize: number; maxAttempts: number }> = {},
) {
  return new OutboxRelay(
    store as unknown as OutboxStore,
    rabbit as unknown as RabbitService,
    silentLog as never,
    {
      intervalMs: 50,
      batchSize: 10,
      maxAttempts: 5,
      ...overrides,
    },
  );
}

// ------------------------------------------------------------------ тесты

describe('OutboxRelay.tick', () => {
  it('публикует PENDING-сообщения и помечает их опубликованными', async () => {
    const store = new FakeStore();
    const rabbit = new FakeRabbit();
    await store.enqueue('doctor.created.v1', { eventId: 'e1', payload: { doctorId: 'd1' } });

    await makeRelay(store, rabbit).tick();

    expect(rabbit.published).toHaveLength(1);
    expect(rabbit.published[0]).toMatchObject({ routingKey: 'doctor.created.v1' });
    expect(store.rows[0]?.status).toBe('PUBLISHED');
    expect(store.claimCalls).toBe(1);
  });

  it('при сбое брокера ставит отложенный повтор, а не теряет событие', async () => {
    const store = new FakeStore();
    const rabbit = new FakeRabbit();
    rabbit.failTimes = 1;
    await store.enqueue('appointment.submitted.v1', { eventId: 'e2' });

    await makeRelay(store, rabbit).tick();

    expect(rabbit.published).toHaveLength(0);
    expect(store.rows[0]).toMatchObject({ status: 'PENDING', attempts: 1 });
    expect(store.rows[0]?.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect(store.rows[0]?.lastError).toBe('broker down');
  });

  it('после лимита попыток помечает событие FAILED (в DLQ-стиле, не в цикле)', async () => {
    const store = new FakeStore();
    const rabbit = new FakeRabbit();
    rabbit.failTimes = 1;
    await store.enqueue('doctor.updated.v1', { eventId: 'e3' });
    store.rows[0]!.attempts = 4; // была 4-я неудача, сейчас будет 5-я

    await makeRelay(store, rabbit, { maxAttempts: 5 }).tick();

    expect(store.rows[0]?.status).toBe('FAILED');
    expect(store.rows[0]?.attempts).toBe(5);
  });

  it('не трогает таблицу, если брокер недоступен', async () => {
    const store = new FakeStore();
    const rabbit = new FakeRabbit();
    rabbit.ready = false;
    await store.enqueue('user.registered.v1', { eventId: 'e4' });

    await makeRelay(store, rabbit).tick();

    expect(store.claimCalls).toBe(0);
    expect(store.rows[0]?.status).toBe('PENDING');
  });

  it('параллельные tick не пересекаются (один проход за раз)', async () => {
    const store = new FakeStore();
    const rabbit = new FakeRabbit();
    await store.enqueue('patient.created.v1', { eventId: 'e5' });

    const relay = makeRelay(store, rabbit);
    await Promise.all([relay.tick(), relay.tick(), relay.tick()]);

    expect(store.claimCalls).toBe(1);
    expect(rabbit.published).toHaveLength(1);
  });

  it('отправляет только пачку batchSize', async () => {
    const store = new FakeStore();
    const rabbit = new FakeRabbit();
    for (let i = 0; i < 5; i += 1) await store.enqueue(`event.${i}.v1`, { i });

    await makeRelay(store, rabbit, { batchSize: 2 }).tick();

    expect(rabbit.published).toHaveLength(2);
    expect(store.rows.filter((r) => r.status === 'PUBLISHED')).toHaveLength(2);
    expect(store.rows.filter((r) => r.status === 'PENDING')).toHaveLength(3);
  });
});

describe('OutboxService', () => {
  it('enqueue пробрасывает в store', async () => {
    const store = new FakeStore();
    const service = new OutboxService(store);

    await service.enqueue('document.uploaded.v1', { key: 'k1' });

    expect(store.rows[0]).toMatchObject({ routingKey: 'document.uploaded.v1' });
  });
});

describe('retryDelayMs', () => {
  it('растёт экспоненциально и ограничена сверху', () => {
    expect(retryDelayMs(0)).toBe(1000);
    expect(retryDelayMs(1)).toBe(2000);
    expect(retryDelayMs(2)).toBe(4000);
    expect(retryDelayMs(10)).toBe(60_000);
  });
});

describe('createPrismaOutboxStore', () => {
  function fakeDelegate() {
    const calls: Record<string, unknown>[] = [];
    return {
      calls,
      delegate: {
        create: async (args: { data: Record<string, unknown> }) => {
          calls.push({ method: 'create', ...args });
          return args.data;
        },
        findMany: async (args: Record<string, unknown>) => {
          calls.push({ method: 'findMany', ...args });
          return [];
        },
        update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
          calls.push({ method: 'update', ...args });
          return {};
        },
      },
    };
  }

  it('enqueue создаёт PENDING-строку', async () => {
    const { calls, delegate } = fakeDelegate();
    const store = createPrismaOutboxStore(delegate);

    await store.enqueue('doctor.created.v1', { a: 1 });

    expect(calls[0]).toMatchObject({
      method: 'create',
      data: { routingKey: 'doctor.created.v1', status: 'PENDING', attempts: 0 },
    });
  });

  it('claim выбирает PENDING с наступившим nextAttemptAt, по возрастанию', async () => {
    const { calls, delegate } = fakeDelegate();
    const store = createPrismaOutboxStore(delegate);

    await store.claim(25);

    expect(calls[0]).toMatchObject({
      method: 'findMany',
      take: 25,
      orderBy: { createdAt: 'asc' },
    });
    const where = (calls[0] as { where: Record<string, Record<string, unknown>> }).where;
    expect(where.status).toBe('PENDING');
    expect(where.nextAttemptAt?.lte).toBeInstanceOf(Date);
  });

  it('markFailed возвращает в PENDING с задержкой или переводит в FAILED', async () => {
    const { calls, delegate } = fakeDelegate();
    const store = createPrismaOutboxStore(delegate);

    await store.markFailed('id-1', new Date('2030-01-01T00:00:00Z'), 'boom');
    await store.markFailed('id-2', null, 'boom');

    expect(calls[0]).toMatchObject({
      method: 'update',
      where: { id: 'id-1' },
      data: { status: 'PENDING', attempts: { increment: 1 } },
    });
    expect(calls[1]).toMatchObject({
      method: 'update',
      where: { id: 'id-2' },
      data: { status: 'FAILED', attempts: { increment: 1 } },
    });
  });
});
