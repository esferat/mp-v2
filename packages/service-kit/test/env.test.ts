import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { baseEnvSchema, loadEnv } from '../src/config/env';

const validEnv: NodeJS.ProcessEnv = {
  SERVICE_NAME: 'svc-catalog',
  PORT: '4000',
  RABBITMQ_URL: 'amqp://localhost:5672',
};

describe('loadEnv', () => {
  it('разбирает валидное окружение с дефолтами', () => {
    const env = loadEnv(undefined, validEnv);

    expect(env.SERVICE_NAME).toBe('svc-catalog');
    expect(env.PORT).toBe(4000); // строка → число (coerce)
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.RABBITMQ_EXCHANGE).toBe('medical.events');
    expect(env.OUTBOX_INTERVAL_MS).toBe(500);
  });

  it('объединяет базовую схему со схемой сервиса', () => {
    const env = loadEnv(
      { DATABASE_URL: z.string().min(1) },
      {
        ...validEnv,
        DATABASE_URL: 'postgresql://localhost/db',
      },
    );

    expect(env.DATABASE_URL).toBe('postgresql://localhost/db');
    expect(env.SERVICE_NAME).toBe('svc-catalog');
  });

  it('падает с понятным сообщением при отсутствии обязательного поля', () => {
    expect(() => loadEnv(undefined, { PORT: '4000' })).toThrow(/SERVICE_NAME/);
  });

  it('падает при некорректном значении', () => {
    expect(() => loadEnv(undefined, { ...validEnv, PORT: '70000' })).toThrow(/PORT/);
  });

  it('падает, если сервис не объявил обязательное поле', () => {
    expect(() => loadEnv({ DATABASE_URL: z.string() }, validEnv)).toThrow(/DATABASE_URL/);
  });
});

describe('baseEnvSchema', () => {
  it('содержит поля брокера и outbox', () => {
    const parsed = baseEnvSchema.parse(validEnv);
    expect(parsed.RABBITMQ_DLX_EXCHANGE).toBe('medical.dlx');
    expect(parsed.OUTBOX_MAX_ATTEMPTS).toBe(5);
    expect(parsed.RABBITMQ_PREFETCH).toBe(10);
  });
});
