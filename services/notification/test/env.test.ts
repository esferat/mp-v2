import { describe, expect, it } from 'vitest';
import { loadNotificationEnv } from '../src/shared/config';

/**
 * Тесты каркаса проходят БЕЗ запущенных PostgreSQL/RabbitMQ (0.7 AC):
 * порты подменены, проверяется только контракт окружения и fail-fast.
 */
describe('loadNotificationEnv', () => {
  const minimal: NodeJS.ProcessEnv = { SERVICE_NAME: 'notification' };

  it('разбирает окружение с дефолтами сервиса', () => {
    const env = loadNotificationEnv(minimal);

    expect(env.SERVICE_NAME).toBe('notification');
    expect(env.PORT).toBe(4007); // сервисный порт, а не 3000
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.RABBITMQ_EXCHANGE).toBe('medical.events');
  });

  it('падает с понятным сообщением при отсутствии обязательных полей', () => {
    expect(() => loadNotificationEnv({})).toThrow(/SERVICE_NAME/);
  });
});
