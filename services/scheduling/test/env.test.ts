import { describe, expect, it } from 'vitest';
import { loadSchedulingEnv } from '../src/shared/config';

/**
 * Тесты каркаса проходят БЕЗ запущенных PostgreSQL/RabbitMQ (0.7 AC):
 * порты подменены, проверяется только контракт окружения и fail-fast.
 */
describe('loadSchedulingEnv', () => {
  const minimal: NodeJS.ProcessEnv = {
    SERVICE_NAME: 'scheduling',
    DATABASE_URL: 'postgresql://svc_schedule:pw@localhost:5432/x',
  };

  it('разбирает окружение с дефолтами сервиса', () => {
    const env = loadSchedulingEnv(minimal);

    expect(env.SERVICE_NAME).toBe('scheduling');
    expect(env.PORT).toBe(4005); // сервисный порт, а не 3000
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.RABBITMQ_EXCHANGE).toBe('medical.events');
  });

  it('падает с понятным сообщением при отсутствии обязательных полей', () => {
    expect(() => loadSchedulingEnv({})).toThrow(/SERVICE_NAME/);
  });

  it('требует DATABASE_URL (fail-fast на старте)', () => {
    expect(() => loadSchedulingEnv({ SERVICE_NAME: 'scheduling' })).toThrow(/DATABASE_URL/);
  });
});
