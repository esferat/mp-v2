import { describe, expect, it } from 'vitest';
import { loadIdentityEnv } from '../src/shared/config';

/**
 * Тесты каркаса проходят БЕЗ запущенных PostgreSQL/RabbitMQ (0.7 AC):
 * порты подменены, проверяется только контракт окружения и fail-fast.
 */
describe('loadIdentityEnv', () => {
  const minimal: NodeJS.ProcessEnv = {
    SERVICE_NAME: 'identity',
    DATABASE_URL: 'postgresql://svc_identity:pw@localhost:5432/x',
  };

  it('разбирает окружение с дефолтами сервиса', () => {
    const env = loadIdentityEnv(minimal);

    expect(env.SERVICE_NAME).toBe('identity');
    expect(env.PORT).toBe(4001); // сервисный порт, а не 3000
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.RABBITMQ_EXCHANGE).toBe('medical.events');
  });

  it('падает с понятным сообщением при отсутствии обязательных полей', () => {
    expect(() => loadIdentityEnv({})).toThrow(/SERVICE_NAME/);
  });

  it('требует DATABASE_URL (fail-fast на старте)', () => {
    expect(() => loadIdentityEnv({ SERVICE_NAME: 'identity' })).toThrow(/DATABASE_URL/);
  });
});
