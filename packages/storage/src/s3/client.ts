import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import { loadStorageEnv, type StorageEnv } from '../config';

/**
 * Фабрика S3-клиента MinIO (0.5): один клиент на процесс,
 * forcePathStyle обязателен для MinIO (без virtual-host DNS).
 */
export function createS3Client(env: StorageEnv = loadStorageEnv()): S3Client {
  const config: S3ClientConfig = {
    endpoint: env.MINIO_ENDPOINT,
    region: env.MINIO_REGION,
    credentials: {
      accessKeyId: env.MINIO_ACCESS_KEY,
      secretAccessKey: env.MINIO_SECRET_KEY,
    },
    forcePathStyle: true,
    // Прокси окружения не должен ломать внутренние вызовы в compose
    maxAttempts: 3,
  };
  return new S3Client(config);
}
