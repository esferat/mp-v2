import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

/**
 * Trace-id живёт в AsyncLocalStorage: middleware кладёт его при входе запроса,
 * пино-миксин подставляет в каждую запись лога внутри этого контекста —
 * ручная прокидка traceId через все слои не нужна (KISS).
 */

export interface TraceContext {
  traceId: string;
}

const storage = new AsyncLocalStorage<TraceContext>();

/** Выполняет fn внутри контекста с данным traceId. */
export function runWithTraceId<T>(traceId: string, fn: () => T): T {
  return storage.run({ traceId }, fn);
}

/** Текущий trace-id (undefined вне контекста запроса — в фоновых задачах). */
export function getTraceId(): string | undefined {
  return storage.getStore()?.traceId;
}

/** Новый уникальный trace-id. */
export function newTraceId(): string {
  return randomUUID();
}
