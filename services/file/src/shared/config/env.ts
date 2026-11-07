import { loadEnv, type BaseEnv } from '@mp/service-kit';
import { z } from 'zod';

/**
 * Схема окружения сервиса file (0.7): старт падает с понятной ошибкой,
 * если переменных не хватает. Базовые поля (LOG_LEVEL, RABBITMQ_*, OUTBOX_*)
 * описаны в service-kit, здесь — только специфичные.
 * Параметры MinIO валидирует @mp/storage (loadStorageEnv) при обращении к S3.
 */
export const FileEnvSchema = z.object({
  /** URL своей БД: доступ только к db_files (architecture.md §5). */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL обязателен'),
  /// Порт по умолчанию — сервисный (перекрывает базовый 3000 из service-kit).
  PORT: z.coerce.number().int().min(1).max(65535).default(4004),

  // --- Вызовы соседних сервисов (4.4: права владельца, привязка фото) ------
  /** patient-service напрямую (проверка владельца PATIENT-файлов, 4.4/4.5). */
  PATIENT_SERVICE_URL: z.string().min(1).default('http://patient:4003'),
  /** catalog-service напрямую (привязка фото врача, 3.4). */
  CATALOG_SERVICE_URL: z.string().min(1).default('http://catalog:4002'),
  /** scheduling-service напрямую (связь «врач-пациент», 9.3). */
  SCHEDULING_SERVICE_URL: z.string().min(1).default('http://scheduling:4005'),
  SERVICE_TIMEOUT_MS: z.coerce.number().int().min(100).default(10_000),

  // --- Service account «svc-file» (client credentials для вызовов) ---------
  KEYCLOAK_SVC_FILE_CLIENT_ID: z.string().min(1).default('svc-file'),
  KEYCLOAK_SVC_FILE_SECRET: z.string().min(1).default('dev-file-secret'),
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
