import { loadEnv, type BaseEnv } from '@mp/service-kit';
import { z } from 'zod';

/**
 * Схема окружения сервиса {{NAME}} (0.7): старт падает с понятной ошибкой,
 * если переменных не хватает. Базовые поля (LOG_LEVEL, RABBITMQ_*, OUTBOX_*)
 * описаны в service-kit, здесь — только специфичные.
 */
export const {{CAP}}EnvSchema = z.object({
{{ENV_SCHEMA_FIELDS}}
  /// Порт по умолчанию — сервисный (перекрывает базовый 3000 из service-kit).
  PORT: z.coerce.number().int().min(1).max(65535).default({{PORT}}),
});

export type {{CAP}}Env = BaseEnv & z.infer<typeof {{CAP}}EnvSchema>;

export function load{{CAP}}Env(source: NodeJS.ProcessEnv = process.env): {{CAP}}Env {
  return loadEnv({{CAP}}EnvSchema.shape, source);
}

let cached: {{CAP}}Env | null = null;

/** Ленивая загрузка окружения (fail-fast при первом обращении, обычно на старте). */
export function get{{CAP}}Env(): {{CAP}}Env {
  cached ??= load{{CAP}}Env();
  return cached;
}
