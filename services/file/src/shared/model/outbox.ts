/**
 * Порт записи событий (fsd.md §4.4: порты — в entities/shared/model,
 * реализация — в service-kit/outbox, сборка — в app).
 *
 * Пишется В ТОЙ ЖЕ транзакции, что и бизнес-изменение (0.9): если транзакция
 * откатилась — события нет; если упала после commit — релеи доставит позже.
 */
export interface OutboxWriter {
  enqueue(routingKey: string, payload: unknown): Promise<void>;
}
