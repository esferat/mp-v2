// Конфигурация и бакеты (0.5)
export { BUCKETS, bucketFor, loadStorageEnv, storageEnvSchema } from './config/env';
export type { BucketName, StorageEnv } from './config/env';

// Presigned-клиент MinIO/S3
export { createS3Client } from './s3/client';
export { deleteObject, putObject } from './s3/objects';
export type { PutObjectRequest } from './s3/objects';
export { presignGet, presignPostForm, presignPut } from './s3/presigned';
export type {
  PresignedPost,
  PresignPostRequest,
  PresignPutRequest,
  PresignRequest,
} from './s3/presigned';
