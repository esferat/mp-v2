import { describe, expect, it } from 'vitest';
import { loadNotificationEnv } from '../src/shared/config';

/**
 * Проверка схемы окружения (0.7): сервис стартует без PostgreSQL/RabbitMQ —
 * переменные валидируются в момент загрузки, а не при подключении (fail-fast).
 */
describe('loadNotificationEnv', () => {
  const minimal: NodeJS.ProcessEnv = {
    SERVICE_NAME: 'notification',
    DATABASE_URL: 'postgresql://x',
  };

  it('дефолты: сервисный порт, rabbit, SMTP Mailpit, whitelist пуст', () => {
    const env = loadNotificationEnv(minimal);

    expect(env.SERVICE_NAME).toBe('notification');
    expect(env.PORT).toBe(4007); // сервисный порт, а не базовый 3000
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.RABBITMQ_EXCHANGE).toBe('medical.events');
    // 6.2: dev-SMTP (Mailpit) и пустой whitelist — шлём всем адресам
    expect(env.SMTP_HOST).toBe('mailpit');
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.SMTP_FROM).toBe('no-reply@test.mp');
    expect(env.SMTP_SECURE).toBe(false);
    expect(env.NOTIFY_SKIP_RECIPIENTS).toBe('');
  });

  it('падает при отсутствии обязательных переменных', () => {
    expect(() => loadNotificationEnv({})).toThrow(/SERVICE_NAME|DATABASE_URL/);
  });

  it('SMTP_SECURE парсится как boolean, а не как строка', () => {
    expect(loadNotificationEnv({ ...minimal, SMTP_SECURE: 'true' }).SMTP_SECURE).toBe(true);
    expect(loadNotificationEnv({ ...minimal, SMTP_SECURE: 'false' }).SMTP_SECURE).toBe(false);
  });
});
