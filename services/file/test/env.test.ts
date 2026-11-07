import { describe, expect, it } from 'vitest';
import { loadFileEnv } from '../src/shared/config';

/**
 * Тесты каркаса проходят БЕЗ запущенных PostgreSQL/RabbitMQ (0.7 AC):
 * порты подменены, проверяется только контракт окружения и fail-fast.
 */
describe('loadFileEnv', () => {
  const minimal: NodeJS.ProcessEnv = {
    SERVICE_NAME: 'file',
    DATABASE_URL: 'postgresql://svc_files:pw@localhost:5432/x',
  };

  it('разбирает окружение с дефолтами сервиса', () => {
    const env = loadFileEnv(minimal);

    expect(env.SERVICE_NAME).toBe('file');
    expect(env.PORT).toBe(4004); // сервисный порт, а не 3000
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.RABBITMQ_EXCHANGE).toBe('medical.events');
  });

  it('падает с понятным сообщением при отсутствии обязательных полей', () => {
    expect(() => loadFileEnv({})).toThrow(/SERVICE_NAME/);
  });

  it('требует DATABASE_URL (fail-fast на старте)', () => {
    expect(() => loadFileEnv({ SERVICE_NAME: 'file' })).toThrow(/DATABASE_URL/);
  });
});
