import { describe, expect, it } from 'vitest';
import {
  incConsumerErrors,
  incOutboxFailed,
  renderMetrics,
  setOutboxLagSeconds,
  setQueueDepths,
} from '../src/metrics/metrics.module';

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

  it('6.1/6.3: сбои outbox, потребителей и глубины очередей видны в метриках', async () => {
    incOutboxFailed();
    incOutboxFailed();
    incConsumerErrors('q.notification.appointment-submitted');
    setQueueDepths('q.notification.appointment-submitted', 7, 2);

    const text = await renderMetrics();

    expect(text).toMatch(/outbox_failed_total 2\n/);
    expect(text).toMatch(
      /consumer_errors_total\{queue="q\.notification\.appointment-submitted"\} 1\n/,
    );
    expect(text).toMatch(/queue_depth\{queue="q\.notification\.appointment-submitted"\} 7\n/);
    expect(text).toMatch(/dlq_depth\{queue="q\.notification\.appointment-submitted"\} 2\n/);
  });

  it('6.1: отрицательные глубины очередей обнуляются', async () => {
    setQueueDepths('q.neg', -5, -1);

    const text = await renderMetrics();

    expect(text).toMatch(/queue_depth\{queue="q\.neg"\} 0\n/);
    expect(text).toMatch(/dlq_depth\{queue="q\.neg"\} 0\n/);
  });
});
