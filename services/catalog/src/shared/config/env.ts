import { loadEnv, type BaseEnv } from '@mp/service-kit';
import { z } from 'zod';

/**
 * Схема окружения каталога (0.7): старт падает с понятной ошибкой,
 * если переменных не хватает. Базовые поля (LOG_LEVEL, RABBITMQ_*, OUTBOX_*)
 * описаны в service-kit, здесь — только специфичные.
 */
export const catalogEnvSchema = z.object({
  /** URL своей БД: доступ только к db_catalog (architecture.md §5). */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL обязателен'),
  /// Порт по умолчанию — сервисный (перекрывает базовый 3000 из service-kit).
  PORT: z.coerce.number().int().min(1).max(65535).default(4002),
});

export type CatalogEnv = BaseEnv & z.infer<typeof catalogEnvSchema>;

export function loadCatalogEnv(source: NodeJS.ProcessEnv = process.env): CatalogEnv {
  return loadEnv(catalogEnvSchema.shape, source);
}

let cached: CatalogEnv | null = null;

/** Ленивая загрузка окружения (fail-fast при первом обращении, обычно на старте). */
export function getCatalogEnv(): CatalogEnv {
  cached ??= loadCatalogEnv();
  return cached;
}
