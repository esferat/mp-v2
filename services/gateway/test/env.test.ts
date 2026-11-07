import { describe, expect, it } from 'vitest';
import { loadGatewayEnv } from '../src/shared/config';

/**
 * Тесты каркаса проходят БЕЗ запущенных PostgreSQL/RabbitMQ (0.7 AC):
 * порты подменены, проверяется только контракт окружения и fail-fast.
 */
describe('loadGatewayEnv', () => {
  const minimal: NodeJS.ProcessEnv = { SERVICE_NAME: 'gateway' };

  it('разбирает окружение с дефолтами сервиса', () => {
    const env = loadGatewayEnv(minimal);

    expect(env.SERVICE_NAME).toBe('gateway');
    expect(env.PORT).toBe(4000); // сервисный порт, а не 3000
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.RABBITMQ_EXCHANGE).toBe('medical.events');
  });

  it('падает с понятным сообщением при отсутствии обязательных полей', () => {
    expect(() => loadGatewayEnv({})).toThrow(/SERVICE_NAME/);
  });
});
