import { describe, expect, it } from 'vitest';
import { loadReportEnv } from '../src/shared/config';

/**
 * Тесты каркаса проходят БЕЗ запущенных PostgreSQL/RabbitMQ (0.7 AC):
 * порты подменены, проверяется только контракт окружения и fail-fast.
 */
describe('loadReportEnv', () => {
  const minimal: NodeJS.ProcessEnv = {
    SERVICE_NAME: 'report',
    DATABASE_URL: 'postgresql://svc_report:pw@localhost:5432/x',
  };

  it('разбирает окружение с дефолтами сервиса', () => {
    const env = loadReportEnv(minimal);

    expect(env.SERVICE_NAME).toBe('report');
    expect(env.PORT).toBe(4006); // сервисный порт, а не 3000
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.RABBITMQ_EXCHANGE).toBe('medical.events');
  });

  it('падает с понятным сообщением при отсутствии обязательных полей', () => {
    expect(() => loadReportEnv({})).toThrow(/SERVICE_NAME/);
  });

  it('требует DATABASE_URL (fail-fast на старте)', () => {
    expect(() => loadReportEnv({ SERVICE_NAME: 'report' })).toThrow(/DATABASE_URL/);
  });
});
