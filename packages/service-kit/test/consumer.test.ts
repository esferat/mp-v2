import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createConsumerHandler } from '../src/messaging/consumer';
import { InboxService, type InboxStore } from '../src/messaging/inbox';
import {
  type ConsumedEvent,
  PermanentConsumerError,
  TransientConsumerError,
} from '../src/messaging/rabbit.types';

const silentLog = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

class FakeInboxStore implements InboxStore {
  readonly processed = new Map<string, string>();

  async has(messageId: string): Promise<boolean> {
    return this.processed.has(messageId);
  }

  async add(messageId: string, routingKey: string): Promise<void> {
    this.processed.set(messageId, routingKey);
  }
}

/** Конверт события как он приходит из очереди. */
function event(body: unknown, routingKey = 'doctor.created.v1'): ConsumedEvent {
  return { routingKey, body, raw: {} as never };
}

const envelope = z.object({
  eventId: z.string().min(1),
  payload: z.object({ doctorId: z.string().min(1) }),
});

function makeHandler(
  overrides: {
    handler?: (payload: z.output<typeof envelope>) => Promise<void>;
    inbox?: InboxService;
    maxAttempts?: number;
  } = {},
) {
  const store = new FakeInboxStore();
  const inbox = overrides.inbox ?? new InboxService(store, silentLog as never);
  const handler = createConsumerHandler({
    queue: 'q.test',
    parse: (e) => envelope.parse(e.body),
    handler: overrides.handler ?? (async () => undefined),
    inbox,
    log: silentLog as never,
    ...(overrides.maxAttempts !== undefined ? { maxAttempts: overrides.maxAttempts } : {}),
    retryDelayMs: 1, // ретраи в тестах без реальных пауз
  });
  return { handler, store };
}

describe('createConsumerHandler (6.3: валидация → inbox → handler)', () => {
  it('валидное событие: parse → handler, eventId зафиксирован в inbox', async () => {
    const { handler, store } = makeHandler();
    const body = { eventId: 'evt-1', payload: { doctorId: 'doc-1' } };

    await handler(event(body));

    expect(store.processed.get('evt-1')).toBe('doctor.created.v1');
  });

  it('AC: двойная доставка того же eventId обрабатывается один раз', async () => {
    let calls = 0;
    const { handler } = makeHandler({
      handler: async () => {
        calls += 1;
      },
    });
    const body = { eventId: 'evt-1', payload: { doctorId: 'doc-1' } };

    await handler(event(body));
    await handler(event(body)); // повторная доставка

    expect(calls).toBe(1);
  });

  it('AC: нарушение схемы уходит в DLQ (пробрасывается) и НЕ пишется в inbox', async () => {
    const { handler, store } = makeHandler();

    await expect(handler(event({ eventId: 'evt-1', payload: {} }))).rejects.toThrow(z.ZodError);
    expect(store.processed.size).toBe(0);
  });

  it('событие без eventId — PermanentConsumerError (яд, без ретраев и inbox)', async () => {
    let calls = 0;
    const { handler } = makeHandler({
      handler: async () => {
        calls += 1;
      },
    });

    await expect(handler(event({ payload: { doctorId: 'd' } }))).rejects.toThrow(
      PermanentConsumerError,
    );
    expect(calls).toBe(0);
  });

  it('ошибка обработчика ретраится и после исчерпания попыток пробрасывается (→ DLQ)', async () => {
    let calls = 0;
    const { handler, store } = makeHandler({
      maxAttempts: 3,
      handler: async () => {
        calls += 1;
        throw new Error('db down');
      },
    });

    await expect(handler(event({ eventId: 'evt-1', payload: { doctorId: 'd' } }))).rejects.toThrow(
      'db down',
    );
    expect(calls).toBe(3); // 1 попытка + 2 повтора
    expect(store.processed.size).toBe(0); // неудача не фиксируется в inbox
  });

  it('временный сбой (TransientConsumerError) ретраится и пробрасывается как есть → requeue', async () => {
    let calls = 0;
    const { handler } = makeHandler({
      maxAttempts: 2,
      handler: async () => {
        calls += 1;
        throw new TransientConsumerError('smtp down');
      },
    });

    await expect(handler(event({ eventId: 'evt-1', payload: { doctorId: 'd' } }))).rejects.toThrow(
      TransientConsumerError,
    );
    expect(calls).toBe(2);
  });

  it('PermanentConsumerError обработчика НЕ ретраится', async () => {
    let calls = 0;
    const { handler } = makeHandler({
      maxAttempts: 5,
      handler: async () => {
        calls += 1;
        throw new PermanentConsumerError('бизнес-отказ');
      },
    });

    await expect(handler(event({ eventId: 'evt-1', payload: { doctorId: 'd' } }))).rejects.toThrow(
      PermanentConsumerError,
    );
    expect(calls).toBe(1);
  });

  it('успех после сбоев: ретраи не дублируют эффект и фиксируют eventId', async () => {
    let calls = 0;
    const { handler, store } = makeHandler({
      maxAttempts: 3,
      handler: async () => {
        calls += 1;
        if (calls < 3) throw new Error('flaky');
      },
    });

    await handler(event({ eventId: 'evt-1', payload: { doctorId: 'd' } }));

    expect(calls).toBe(3);
    expect(store.processed.get('evt-1')).toBe('doctor.created.v1');
  });
});
