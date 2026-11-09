import { describe, expect, it } from 'vitest';
import { renderMetrics, setOutboxLagSeconds } from '../src/metrics/metrics.module';

/**
 * Метрики процесса (0.9 AC: «лаг relay виден в метрике outbox_lag_seconds»):
 * реестр отдаёт Prometheus-текст с лагом и стандартными метриками процесса.
 */
describe('метрики (/metrics, 0.9)', () => {
  it('лаг публикации outbox виден в тексте метрик', async () => {
    setOutboxLagSeconds(12.5);

    const text = await renderMetrics();

    expect(text).toContain('outbox_lag_seconds');
    expect(text).toMatch(/outbox_lag_seconds 12\.5\n/);
  });

  it('отрицательный лаг обнуляется (защита от артефактов часов)', async () => {
    setOutboxLagSeconds(-1);

    const text = await renderMetrics();

    expect(text).toMatch(/outbox_lag_seconds 0\n/);
  });

  it('дефолт-метрики процесса экспортируются (Prometheus scrape)', async () => {
    const text = await renderMetrics();

    expect(text).toContain('process_');
    expect(text).toContain('# HELP');
  });
});
