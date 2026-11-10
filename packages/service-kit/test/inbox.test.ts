import { describe, expect, it } from 'vitest';
import { createPrismaInboxStore, InboxService, type InboxStore } from '../src/messaging/inbox';

const silentLog = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

class FakeInboxStore implements InboxStore {
  readonly processed = new Map<string, string>();
  failOnAdd = false;

  async has(messageId: string): Promise<boolean> {
    return this.processed.has(messageId);
  }

  async add(messageId: string, routingKey: string): Promise<void> {
    if (this.failOnAdd) throw new Error('unique violation');
    this.processed.set(messageId, routingKey);
  }
}

function makeService(store: InboxStore): InboxService {
  return new InboxService(store, silentLog as never);
}

describe('InboxService.runOnce', () => {
  it('первый вызов выполняет обработчик и фиксирует messageId', async () => {
    const store = new FakeInboxStore();
    let calls = 0;

    const result = await makeService(store).runOnce('msg-1', 'doctor.created.v1', async () => {
      calls += 1;
      return 'ok';
    });

    expect(result).toEqual({ executed: true, result: 'ok' });
    expect(calls).toBe(1);
    expect(store.processed.get('msg-1')).toBe('doctor.created.v1');
  });

  it('повторная доставка того же messageId не выполняет обработчик', async () => {
    const store = new FakeInboxStore();
    const service = makeService(store);
    let calls = 0;
    const handler = async () => {
      calls += 1;
    };

    await service.runOnce('msg-1', 'doctor.created.v1', handler);
    const second = await service.runOnce('msg-1', 'doctor.created.v1', handler);

    expect(second).toEqual({ executed: false });
    expect(calls).toBe(1);
  });

  it('разные messageId обрабатываются независимо', async () => {
    const store = new FakeInboxStore();
    const service = makeService(store);
    let calls = 0;
    const handler = async () => {
      calls += 1;
    };

    await service.runOnce('msg-1', 'rk', handler);
    await service.runOnce('msg-2', 'rk', handler);

    expect(calls).toBe(2);
  });

  it('ошибка обработчика не фиксируется в inbox — повтор доставки обработает снова', async () => {
    const store = new FakeInboxStore();
    const service = makeService(store);

    await expect(
      service.runOnce('msg-1', 'rk', async () => {
        throw new Error('db down');
      }),
    ).rejects.toThrow('db down');
    expect(store.processed.has('msg-1')).toBe(false);

    const retry = await service.runOnce('msg-1', 'rk', async () => 'recovered');
    expect(retry).toEqual({ executed: true, result: 'recovered' });
  });

  it('гонка параллельных потребителей (уникальный индекс) не валит обработку', async () => {
    const store = new FakeInboxStore();
    store.failOnAdd = true; // add бросает «unique violation»

    const result = await makeService(store).runOnce('msg-1', 'rk', async () => 'done');

    expect(result).toEqual({ executed: true, result: 'done' });
  });
});

describe('createPrismaInboxStore', () => {
  it('has читает findUnique по messageId', async () => {
    const calls: Record<string, unknown>[] = [];
    const store = createPrismaInboxStore({
      findUnique: async (args) => {
        calls.push(args);
        return null;
      },
      create: async (args) => args.data,
    });

    expect(await store.has('m1')).toBe(false);
    expect(calls[0]).toMatchObject({ where: { messageId: 'm1' } });
  });

  it('has=true, когда строка найдена; add пишет messageId и routingKey', async () => {
    const created: Record<string, unknown>[] = [];
    const store = createPrismaInboxStore({
      findUnique: async () => ({ messageId: 'm1' }),
      create: async (args) => {
        created.push(args.data);
        return args.data;
      },
    });

    expect(await store.has('m1')).toBe(true);
    await store.add('m1', 'appointment.approved.v1');
    expect(created[0]).toEqual({ messageId: 'm1', routingKey: 'appointment.approved.v1' });
  });
});
