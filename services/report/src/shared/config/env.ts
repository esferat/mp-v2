import { loadEnv, type BaseEnv } from '@mp/service-kit';
import { z } from 'zod';

/**
 * Схема окружения сервиса report (0.7): старт падает с понятной ошибкой,
 * если переменных не хватает. Базовые поля (LOG_LEVEL, RABBITMQ_*, OUTBOX_*)
 * описаны в service-kit, здесь — только специфичные.
 */
export const ReportEnvSchema = z.object({
  /** URL своей БД: доступ только к db_report (architecture.md §5). */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL обязателен'),
  /// Порт по умолчанию — сервисный (перекрывает базовый 3000 из service-kit).
  PORT: z.coerce.number().int().min(1).max(65535).default(4006),
});

export type ReportEnv = BaseEnv & z.infer<typeof ReportEnvSchema>;

export function loadReportEnv(source: NodeJS.ProcessEnv = process.env): ReportEnv {
  return loadEnv(ReportEnvSchema.shape, source);
}

let cached: ReportEnv | null = null;

/** Ленивая загрузка окружения (fail-fast при первом обращении, обычно на старте). */
export function getReportEnv(): ReportEnv {
  cached ??= loadReportEnv();
  return cached;
}
