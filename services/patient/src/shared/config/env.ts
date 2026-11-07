import { loadEnv, type BaseEnv } from '@mp/service-kit';
import { z } from 'zod';

/**
 * Схема окружения сервиса patient (0.7): старт падает с понятной ошибкой,
 * если переменных не хватает. Базовые поля (LOG_LEVEL, RABBITMQ_*, OUTBOX_*)
 * описаны в service-kit, здесь — только специфичные.
 */
export const PatientEnvSchema = z.object({
  /** URL своей БД: доступ только к db_patients (architecture.md §5). */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL обязателен'),
  /// Порт по умолчанию — сервисный (перекрывает базовый 3000 из service-kit).
  PORT: z.coerce.number().int().min(1).max(65535).default(4003),
});

export type PatientEnv = BaseEnv & z.infer<typeof PatientEnvSchema>;

export function loadPatientEnv(source: NodeJS.ProcessEnv = process.env): PatientEnv {
  return loadEnv(PatientEnvSchema.shape, source);
}

let cached: PatientEnv | null = null;

/** Ленивая загрузка окружения (fail-fast при первом обращении, обычно на старте). */
export function getPatientEnv(): PatientEnv {
  cached ??= loadPatientEnv();
  return cached;
}
