import { type BaseEnv, loadEnv } from '@mp/service-kit';
import { z } from 'zod';

/**
 * Схема окружения сервиса notification (0.7/6.2): старт падает с понятной ошибкой,
 * если переменных не хватает. Базовые поля (LOG_LEVEL, RABBITMQ_*, OUTBOX_*)
 * описаны в service-kit, здесь — только специфичные.
 *
 * Специфичные (6.2):
 *  - DATABASE_URL — inbox идемпотентности (db_notification, архитектура §5);
 *  - SMTP_* — dev-SMTP (Mailpit), фиксированный `from` по спеке;
 *  - PATIENT_SERVICE_URL + service account — резолв email пациента по patientId
 *    (в событиях appointment.* email не денализован — PII, см. architecture §6);
 *  - NOTIFY_SKIP_RECIPIENTS — env-whitelist тестовых адресов: письма им не шлются.
 */
export const NotificationEnvSchema = z.object({
  /** URL своей БД: только db_notification (architecture.md §5). */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL обязателен'),
  /// Порт по умолчанию — сервисный (перекрывает базовый 3000 из service-kit).
  PORT: z.coerce.number().int().min(1).max(65535).default(4007),

  // --- SMTP (6.2) -----------------------------------------------------------
  /** SMTP-сервер (dev: Mailpit в compose). */
  SMTP_HOST: z.string().min(1).default('mailpit'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  /** Фиксированный отправитель (спека 6.2). */
  SMTP_FROM: z.string().min(1).default('no-reply@test.mp'),
  /** Требуется ли STARTTLS/SSL (Mailpit в dev — нет). Строковый парсинг: `Boolean("false") === true`. */
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /** Аутентификация на SMTP (пусто в dev: Mailpit без auth). */
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),

  // --- Резолв получателя (6.2) --------------------------------------------
  PATIENT_SERVICE_URL: z.string().min(1).default('http://patient:4003'),
  /** Таймаут исходящих вызовов, мс. */
  SERVICE_TIMEOUT_MS: z.coerce.number().int().min(100).default(10_000),
  /** Service account <svc-backend> для вызовов внутренних маршрутов patient. */
  KEYCLOAK_SVC_BACKEND_CLIENT_ID: z.string().min(1).default('svc-backend'),
  KEYCLOAK_SVC_BACKEND_SECRET: z.string().min(1).default('dev-backend-secret'),

  // --- Whitelist тестовых адресов (6.2) ------------------------------------
  /**
   * Список адресов/доменов, на которые письма НЕ шлются (через запятую).
   * Пусто = шлём всем. Пример: `@test.mp, bot@example.com`.
   */
  NOTIFY_SKIP_RECIPIENTS: z.string().default(''),
});

export type NotificationEnv = BaseEnv & z.infer<typeof NotificationEnvSchema>;

export function loadNotificationEnv(source: NodeJS.ProcessEnv = process.env): NotificationEnv {
  return loadEnv(NotificationEnvSchema.shape, source);
}

let cached: NotificationEnv | null = null;

/** Ленивая загрузка окружения (fail-fast при первом обращении, обычно на старте). */
export function getNotificationEnv(): NotificationEnv {
  cached ??= loadNotificationEnv();
  return cached;
}
