import { Controller, Get, Header, Module } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Gauge, Registry } from 'prom-client';

/**
 * Метрики Prometheus (0.9 / наблюдаемость): единый реестр на процесс, endpoint
 * `/metrics` отдаётся всеми сервисами — модуль подключён в HealthModule
 * (features/health каждого сервиса), без токена (см. isPublicPath).
 *
 * Ключевая метрика этапа — `outbox_lag_seconds` (AC 0.9 «лаг relay виден
 * в метрике»): возраст (сек) старшей записи в последней забранной пачке,
 * 0 — пачек нет. Обновляется в OutboxRelay.tick(); при недоступности брокера
 * relay не забирает пачки, значение замораживается на последнем известном.
 *
 * Этап 3 (6.1/6.3): `outbox_failed_total` — неудачные попытки публикации
 * (алерт «не потерять молча»), `consumer_errors_total` — сбои обработчиков
 * (после ретраев → DLQ), `queue_depth`/`dlq_depth` — размеры очередей
 * (опрашивает RabbitService, см. startQueueMetrics).
 */
const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const outboxLagSeconds = new Gauge({
  name: 'outbox_lag_seconds',
  help: 'Возраст (сек) старшей записи в последней пачке outbox (0 — пачек нет)',
  registers: [registry],
});

/** Текущий лаг публикации событий (вызывает OutboxRelay после claim). */
export function setOutboxLagSeconds(seconds: number): void {
  outboxLagSeconds.set(Math.max(0, seconds));
}

/** Неудачные попытки публикации событий (6.1: алерт на рост — событие не должно потеряться молча). */
export const outboxFailedTotal = new Counter({
  name: 'outbox_failed_total',
  help: 'Число неудачных попыток публикации записей outbox (ретраи и FAILED)',
  registers: [registry],
});

/** Сбои обработчиков потребителей (6.3: после ретраев сообщение уходит в DLQ). */
export const consumerErrorsTotal = new Counter({
  name: 'consumer_errors_total',
  help: 'Число ошибок обработки сообщений потребителями (по очередям)',
  labelNames: ['queue'],
  registers: [registry],
});

/** Глубина основной очереди потребителя (6.1: размер очередей). */
export const queueDepth = new Gauge({
  name: 'queue_depth',
  help: 'Сообщений в очереди потребителя (0 — пусто)',
  labelNames: ['queue'],
  registers: [registry],
});

/** Глубина DLQ (6.3: алерт на рост — отравленные/несрабатываемые сообщения). */
export const dlqDepth = new Gauge({
  name: 'dlq_depth',
  help: 'Сообщений в DLQ потребителя (0 — пусто)',
  labelNames: ['queue'],
  registers: [registry],
});

/** Зафиксировать неудачную попытку публикации (вызывает OutboxRelay). */
export function incOutboxFailed(): void {
  outboxFailedTotal.inc();
}

/** Зафиксировать сбой обработчика сообщения (вызывает RabbitService.dispatch). */
export function incConsumerErrors(queue: string): void {
  consumerErrorsTotal.inc({ queue });
}

/** Обновить размеры очередей (вызывает RabbitService при опросе). */
export function setQueueDepths(queue: string, depth: number, dlq: number): void {
  queueDepth.set({ queue }, Math.max(0, depth));
  dlqDepth.set({ queue }, Math.max(0, dlq));
}

/** Текст метрик в формате Prometheus (для /metrics и тестов). */
export function renderMetrics(): Promise<string> {
  return registry.metrics();
}

@Controller()
class MetricsController {
  /**
   * Scrape-эндпоинт Prometheus: `text/plain`, без аутентификации
   * (isPublicPath) и без кэширования.
   */
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  metrics(): Promise<string> {
    return renderMetrics();
  }
}

@Module({ controllers: [MetricsController] })
export class MetricsModule {}
