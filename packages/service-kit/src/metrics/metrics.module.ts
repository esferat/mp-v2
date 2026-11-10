import { Controller, Get, Header, Module } from '@nestjs/common';
import { collectDefaultMetrics, Gauge, Registry } from 'prom-client';

/**
 * Метрики Prometheus (0.9 / наблюдаемость): единый реестр на процесс, endpoint
 * `/metrics` отдаётся всеми сервисами — модуль подключён в HealthModule
 * (features/health каждого сервиса), без токена (см. isPublicPath).
 *
 * Ключевая метрика этапа — `outbox_lag_seconds` (AC 0.9 «лаг relay виден
 * в метрике»): возраст (сек) старшей записи в последней забранной пачке,
 * 0 — пачек нет. Обновляется в OutboxRelay.tick(); при недоступности брокера
 * relay не забирает пачки, значение замораживается на последнем известном.
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
