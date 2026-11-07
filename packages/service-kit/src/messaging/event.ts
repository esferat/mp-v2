import { randomUUID } from 'node:crypto';
import { getTraceId } from '../logger/context';

/** Метаданные конверта события (см. eventEnvelope в @mp/contracts). */
export interface EventMeta {
  eventId: string;
  /** ISO-8601. */
  occurredAt: string;
  /** Трассировка запроса-источника — пробрасывается из текущего контекста. */
  traceId?: string;
}

/** Метаданные нового события: uuid + сейчас + traceId текущего запроса (если есть). */
export function createEventMeta(): EventMeta {
  const traceId = getTraceId();
  return {
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    ...(traceId ? { traceId } : {}),
  };
}

/**
 * Конверт события: `{...meta, payload}` — форма, которую принимает outbox
 * и которая валидируется Zod-схемой из @mp/contracts на стороне потребителя.
 */
export function createEvent<T>(payload: T): EventMeta & { payload: T } {
  return { ...createEventMeta(), payload };
}
