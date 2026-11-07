import { z } from 'zod';

/**
 * Конверт события (architecture.md §6.3): то, что реально лежит в очереди
 * `medical.events`. Полезная нагрузка — в `payload`, её схема версионируется
 * отдельно от конверта.
 */
export const eventMetaSchema = z.object({
  eventId: z.uuid(),
  occurredAt: z.iso.datetime(),
  /** Трассировка запроса-источника (x-request-id) */
  traceId: z.string().min(1).optional(),
});
export type EventMeta = z.infer<typeof eventMetaSchema>;

/** Оборачивает payload-схему в конверт события. */
export function eventEnvelope<T extends z.ZodType>(payload: T) {
  return z.object({ ...eventMetaSchema.shape, payload });
}

export type Envelope<P> = EventMeta & { payload: P };
