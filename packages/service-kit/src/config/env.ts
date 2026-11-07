import { z } from 'zod';

/**
 * Валидация окружения при старте (0.7): единая схема для всех сервисов.
 * Базовые поля — общие для всех, сервис добавляет свои через loadEnv(extra).
 * Ошибка валидации валит процесс сразу — лучше упасть на старте, чем получить
 * неопределённое поведение в рантайме (fail fast).
 */

export const logLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
export type LogLevel = (typeof logLevels)[number];

export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(logLevels).default('info'),
  /** Имя сервиса — попадает в каждую запись лога (поле service). */
  SERVICE_NAME: z.string().min(1),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  // RabbitMQ (architecture.md §6.3)
  RABBITMQ_URL: z.string().min(1).default('amqp://localhost:5672'),
  RABBITMQ_EXCHANGE: z.string().min(1).default('medical.events'),
  RABBITMQ_DLX_EXCHANGE: z.string().min(1).default('medical.dlx'),
  RABBITMQ_PREFETCH: z.coerce.number().int().min(1).max(1000).default(10),

  // Outbox (0.9)
  OUTBOX_INTERVAL_MS: z.coerce.number().int().min(50).default(500),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(50),
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(100).default(5),

  // --- Аутентификация (1.2: защита в глубину в каждом сервисе) ---------------
  /** Внутренний адрес Keycloak для jwks. */
  KEYCLOAK_INTERNAL_URL: z.string().min(1).default('http://keycloak:8080'),
  /** Публичный адрес — он стоит в claim iss токена. */
  KEYCLOAK_PUBLIC_URL: z.string().min(1).default('http://localhost:8180'),
  KEYCLOAK_REALM: z.string().min(1).default('medical-portal'),
  /** Ожидаемые аудиории (client_id через запятую). */
  AUTH_AUDIENCE: z.string().min(1).default('next-web,svc-e2e,svc-gateway,svc-backend,svc-identity'),
  /**
   * Публичные маршруты сервиса (через запятую, по префиксу) — без токена.
   * /healthz и /readyz публичны всегда; identity добавляет /api/identity/register.
   */
  AUTH_PUBLIC_PATHS: z.string().default(''),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;

/**
 * Разбирает окружение, объединяя базовую схему со схемой конкретного сервиса.
 *
 * @param extra — дополнительные поля схемы сервиса (DATABASE_URL и т.п.)
 * @param source — источник значений (по умолчанию process.env); в тестах передаётся объект
 */
export function loadEnv<Extra extends z.ZodRawShape = Record<string, never>>(
  extra?: Extra,
  source: NodeJS.ProcessEnv = process.env,
): BaseEnv & z.infer<z.ZodObject<Extra>> {
  const schema: z.ZodType = extra ? baseEnvSchema.extend(extra) : baseEnvSchema;
  const parsed = schema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(корень)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Некорректное окружение (${parsed.error.issues.length} ошибок):\n${details}`);
  }

  return parsed.data as BaseEnv & z.infer<z.ZodObject<Extra>>;
}
