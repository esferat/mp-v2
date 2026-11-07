import { loadEnv, type BaseEnv } from '@mp/service-kit';
import { z } from 'zod';

/**
 * Схема окружения сервиса file (0.7): старт падает с понятной ошибкой,
 * если переменных не хватает. Базовые поля (LOG_LEVEL, RABBITMQ_*, OUTBOX_*)
 * описаны в service-kit, здесь — только специфичные.
 */
export const FileEnvSchema = z.object({
  /** URL своей БД: доступ только к db_files (architecture.md §5). */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL обязателен'),
  /// Порт по умолчанию — сервисный (перекрывает базовый 3000 из service-kit).
  PORT: z.coerce.number().int().min(1).max(65535).default(4004),
});

export type FileEnv = BaseEnv & z.infer<typeof FileEnvSchema>;

export function loadFileEnv(source: NodeJS.ProcessEnv = process.env): FileEnv {
  return loadEnv(FileEnvSchema.shape, source);
}

let cached: FileEnv | null = null;

/** Ленивая загрузка окружения (fail-fast при первом обращении, обычно на старте). */
export function getFileEnv(): FileEnv {
  cached ??= loadFileEnv();
  return cached;
}
