import { describe, expect, it } from 'vitest';
import { createLogger } from '../src/logger/logger';
import { getTraceId, newTraceId, runWithTraceId } from '../src/logger/context';

/** Поток-приёмник логов в памяти (для проверки JSON-формата). */
class MemoryStream {
  public readonly chunks: string[] = [];

  write(chunk: string): void {
    this.chunks.push(chunk);
  }

  lines(): Record<string, unknown>[] {
    return this.chunks
      .join('')
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  }
}

describe('trace-контекст', () => {
  it('runWithTraceId кладёт и снимает traceId', () => {
    expect(getTraceId()).toBeUndefined();

    const inside = runWithTraceId('trace-1', () => getTraceId());
    expect(inside).toBe('trace-1');
    expect(getTraceId()).toBeUndefined();
  });

  it('переживает асинхронные операции внутри контекста', async () => {
    await runWithTraceId('trace-2', async () => {
      await Promise.resolve();
      expect(getTraceId()).toBe('trace-2');
    });
    expect(getTraceId()).toBeUndefined();
  });

  it('newTraceId генерирует уникальные значения', () => {
    expect(newTraceId()).not.toBe(newTraceId());
  });
});

describe('createLogger', () => {
  it('пишет JSON с service и traceId внутри контекста', () => {
    const stream = new MemoryStream();
    const log = createLogger({ name: 'svc-test', destination: stream });

    runWithTraceId('trace-3', () => {
      log.info({ eventId: 'e-1' }, 'событие');
    });

    const [entry] = stream.lines();
    expect(entry).toMatchObject({
      level: 30,
      service: 'svc-test',
      traceId: 'trace-3',
      eventId: 'e-1',
      msg: 'событие',
    });
    // ISO-строка времени (не epoch) — удобно для Kibana (0.10)
    expect(entry?.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('без контекста traceId отсутствует (фоновые задачи)', () => {
    const stream = new MemoryStream();
    const log = createLogger({ name: 'svc-test', destination: stream });

    log.warn('фон');

    const [entry] = stream.lines();
    expect(entry).toMatchObject({ level: 40, msg: 'фон' });
    expect(entry).not.toHaveProperty('traceId');
  });

  it('фильтрует записи ниже уровня', () => {
    const stream = new MemoryStream();
    const log = createLogger({ name: 'svc-test', level: 'warn', destination: stream });

    log.debug('не должно попасть');
    log.error('должно попасть');

    const lines = stream.lines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: 50, msg: 'должно попасть' });
  });
});
