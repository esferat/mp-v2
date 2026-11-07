import { z } from 'zod';
import type { FileKind, OwnerType } from '@mp/contracts';

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
  /**
   * Публичный адрес MinIO для presigned-ссылок (4.5): подпись должна
   * указывать на хост, доступный браузеру (localhost:9000), тогда как
   * MINIO_ENDPOINT (minio:9000) используется для внутренних вызовов
   * PutObject из контейнеров.
   */
  MINIO_PUBLIC_ENDPOINT: z.string().min(1).default('http://localhost:9000'),
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

/**
 * Бакет по владельцу и виду файла (4.4): единственная точка знания
 * «куда класть» — ею пользуются file-service (загрузка) и сервисы,
 * подписывающие photoUrl (patient/catalog).
 *
 * DOCUMENT — только у пациента (сканы/направления): врач кладёт
 * документы ПАЦИЕНТА (ownerType=PATIENT, 9.3), свои файлы — фото.
 */
export function bucketFor(ownerType: OwnerType, kind: FileKind): string {
  if (kind === 'DOCUMENT') {
    if (ownerType !== 'PATIENT') {
      throw new Error('DOCUMENT поддерживается только для ownerType=PATIENT');
    }
    return BUCKETS.patientDocs;
  }
  return ownerType === 'PATIENT' ? BUCKETS.patientPhotos : BUCKETS.doctorPhotos;
}
