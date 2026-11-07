import { z } from 'zod';

/**
 * Конфигурация хранилища (0.5): env валидируется при первом обращении,
 * ошибка — с понятным сообщением (fail-fast).
 *
 * В контейнерах endpoint = http://minio:9000, на хосте — http://localhost:9000.
 */
export const storageEnvSchema = z.object({
  MINIO_ENDPOINT: z.string().min(1).default('http://localhost:9000'),
  MINIO_ACCESS_KEY: z.string().min(1).default('minio'),
  MINIO_SECRET_KEY: z.string().min(1).default('minio123'),
  /// Регион не обязателен для MinIO, но SDK требует строку.
  MINIO_REGION: z.string().default('us-east-1'),
  /// TTL presigned-ссылки GET (NFR портала: 5 минут).
  PRESIGNED_TTL_SECONDS: z.coerce.number().int().min(10).max(604800).default(300),
});

export type StorageEnv = z.infer<typeof storageEnvSchema>;

/** Кэш для дефолтного source (process.env): zod-parse на каждый presign — лишний CPU. */
let cachedDefault: StorageEnv | null = null;

export function loadStorageEnv(source: NodeJS.ProcessEnv = process.env): StorageEnv {
  const isDefault = source === process.env;
  if (isDefault && cachedDefault) return cachedDefault;

  const parsed = storageEnvSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Некорректное окружение хранилища:\n${details}`);
  }
  if (isDefault) cachedDefault = parsed.data;
  return parsed.data;
}

/** Бакеты портала (0.5; создаётся infra/minio-init идемпотентно). */
export const BUCKETS = {
  patientPhotos: 'patient-photos',
  doctorPhotos: 'doctor-photos',
  patientDocs: 'patient-docs',
  tmp: 'tmp',
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];
