import { describe, expect, it } from 'vitest';
import { load{{CAP}}Env } from '../src/shared/config';

/**
 * Тесты каркаса проходят БЕЗ запущенных PostgreSQL/RabbitMQ (0.7 AC):
 * порты подменены, проверяется только контракт окружения и fail-fast.
 */
describe('load{{CAP}}Env', () => {
  const minimal: NodeJS.ProcessEnv = { SERVICE_NAME: '{{NAME}}'{{TEST_MINIMAL}} };

  it('разбирает окружение с дефолтами сервиса', () => {
    const env = load{{CAP}}Env(minimal);

    expect(env.SERVICE_NAME).toBe('{{NAME}}');
    expect(env.PORT).toBe({{PORT}}); // сервисный порт, а не 3000
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.RABBITMQ_EXCHANGE).toBe('medical.events');
  });

  it('падает с понятным сообщением при отсутствии обязательных полей', () => {
    expect(() => load{{CAP}}Env({})).toThrow(/SERVICE_NAME/);
  });
{{ENV_TESTS}}
});
