import { type BaseEnv, loadEnv } from '@mp/service-kit';
import { z } from 'zod';

/**
 * Схема окружения сервиса notification (0.7): старт падает с понятной ошибкой,
 * если переменных не хватает. Базовые поля (LOG_LEVEL, RABBITMQ_*, OUTBOX_*)
 * описаны в service-kit, здесь — только специфичные.
 */
export const NotificationEnvSchema = z.object({
  // Сервис без собственной БД — специфичных переменных нет (0.7)
  /// Порт по умолчанию — сервисный (перекрывает базовый 3000 из service-kit).
  PORT: z.coerce.number().int().min(1).max(65535).default(4007),
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
