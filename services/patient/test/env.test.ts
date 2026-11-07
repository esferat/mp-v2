import { describe, expect, it } from 'vitest';
import { loadPatientEnv } from '../src/shared/config';

/**
 * Тесты каркаса проходят БЕЗ запущенных PostgreSQL/RabbitMQ (0.7 AC):
 * порты подменены, проверяется только контракт окружения и fail-fast.
 */
describe('loadPatientEnv', () => {
  const minimal: NodeJS.ProcessEnv = {
    SERVICE_NAME: 'patient',
    DATABASE_URL: 'postgresql://svc_patients:pw@localhost:5432/x',
  };

  it('разбирает окружение с дефолтами сервиса', () => {
    const env = loadPatientEnv(minimal);

    expect(env.SERVICE_NAME).toBe('patient');
    expect(env.PORT).toBe(4003); // сервисный порт, а не 3000
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.RABBITMQ_EXCHANGE).toBe('medical.events');
  });

  it('падает с понятным сообщением при отсутствии обязательных полей', () => {
    expect(() => loadPatientEnv({})).toThrow(/SERVICE_NAME/);
  });

  it('требует DATABASE_URL (fail-fast на старте)', () => {
    expect(() => loadPatientEnv({ SERVICE_NAME: 'patient' })).toThrow(/DATABASE_URL/);
  });
});
