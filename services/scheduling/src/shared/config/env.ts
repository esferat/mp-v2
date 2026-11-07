import { loadEnv, type BaseEnv } from '@mp/service-kit';
import { z } from 'zod';

/**
 * Схема окружения сервиса scheduling (0.7): старт падает с понятной ошибкой,
 * если переменных не хватает. Базовые поля (LOG_LEVEL, RABBITMQ_*, OUTBOX_*)
 * описаны в service-kit, здесь — только специфичные.
 */
export const SchedulingEnvSchema = z.object({
  /** URL своей БД: доступ только к db_schedule (architecture.md §5). */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL обязателен'),
  /// Порт по умолчанию — сервисный (перекрывает базовый 3000 из service-kit).
  PORT: z.coerce.number().int().min(1).max(65535).default(4005),

  // --- Вызовы соседних сервисов (5.1/5.3/5.5) ------------------------------
  /** patient-service: пациент по sub при бронировании и для истории (5.3/5.5). */
  PATIENT_SERVICE_URL: z.string().min(1).default('http://patient:4003'),
  /** catalog-service: bootstrap/fallback копий расписания (5.1). */
  CATALOG_SERVICE_URL: z.string().min(1).default('http://catalog:4002'),
  SERVICE_TIMEOUT_MS: z.coerce.number().int().min(100).default(10_000),

  // --- Service account «svc-backend» (client credentials для вызовов) ------
  KEYCLOAK_SVC_BACKEND_CLIENT_ID: z.string().min(1).default('svc-backend'),
  KEYCLOAK_SVC_BACKEND_SECRET: z.string().min(1).default('dev-backend-secret'),
});

export type SchedulingEnv = BaseEnv & z.infer<typeof SchedulingEnvSchema>;

export function loadSchedulingEnv(source: NodeJS.ProcessEnv = process.env): SchedulingEnv {
  return loadEnv(SchedulingEnvSchema.shape, source);
}

let cached: SchedulingEnv | null = null;

/** Ленивая загрузка окружения (fail-fast при первом обращении, обычно на старте). */
export function getSchedulingEnv(): SchedulingEnv {
  cached ??= loadSchedulingEnv();
  return cached;
}
