import { GetObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { loadStorageEnv } from '../config';

export interface PresignRequest {
  bucket: string;
  /** Ключ объекта в бакете (путь вида `<ownerId>/<имя файла>`). */
  key: string;
  /** TTL в секундах; по умолчанию PRESIGNED_TTL_SECONDS (5 минут). */
  expiresInSeconds?: number;
}

export interface PresignPutRequest extends PresignRequest {
  /** MIME-тип: попадает в подпись — скачать можно будет только этим типом. */
  contentType: string;
}

export interface PresignPostRequest extends PresignRequest {
  /** Разрешённый MIME-тип (eq-условие политики). */
  contentType: string;
  /** Ограничение размера, байт (content-length-range; ≤ 5 МБ для сканов). */
  maxBytes: number;
}

export interface PresignedPost {
  /** Куда отправлять multipart/form-data. */
  url: string;
  /** Поля формы (key, policy, подписи) — разворачиваются в <input type=hidden>. */
  fields: Record<string, string>;
}

/**
 * Presigned GET (0.5): ссылка истекает через TTL, объект недоступен
 * напрямую по URL без подписи (бакеты — private).
 */
export async function presignGet(client: S3Client, request: PresignRequest): Promise<string> {
  const { bucket, key, expiresInSeconds } = resolve(request);
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: expiresInSeconds,
  });
}

/**
 * Presigned PUT (0.5): подпись фиксирует bucket/key/content-type —
 * загрузить можно только заявленным типом. Ограничение размера задаётся
 * политикой бакета и валидацией file-service до выдачи ссылки (≤ 5 МБ).
 */
export async function presignPut(client: S3Client, request: PresignPutRequest): Promise<string> {
  const { bucket, key, expiresInSeconds } = resolve(request);
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: request.contentType,
    }),
    { expiresIn: expiresInSeconds },
  );
}

function resolve(request: PresignRequest): Required<PresignRequest> {
  const env = loadStorageEnv();
  if (!request.bucket) throw new Error('bucket обязателен');
  if (!request.key) throw new Error('key обязателен');
  return {
    bucket: request.bucket,
    key: request.key,
    expiresInSeconds: request.expiresInSeconds ?? env.PRESIGNED_TTL_SECONDS,
  };
}

/**
 * Presigned POST (0.5: «PUT-ссылка ограничена размером и типом (policy)»).
 *
 * В отличие от PUT-подписи, POST-policy умеет ограничивать РАЗМЕР
 * (content-length-range) и ТИП (eq $Content-Type) — MinIO отклоняет
 * запрос, не удовлетворяющий условиям политики. Клиент отправляет
 * multipart/form-data с полями из `fields`.
 */
export async function presignPostForm(
  client: S3Client,
  request: PresignPostRequest,
): Promise<PresignedPost> {
  const { bucket, key, expiresInSeconds } = resolve(request);
  if (request.maxBytes <= 0) throw new Error('maxBytes должен быть > 0');
  if (!request.contentType) throw new Error('contentType обязателен');

  const post = await createPresignedPost(client, {
    Bucket: bucket,
    Key: key,
    Expires: expiresInSeconds,
    Conditions: [
      ['content-length-range', 1, request.maxBytes],
      ['eq', '$Content-Type', request.contentType],
    ],
    Fields: { 'Content-Type': request.contentType },
  });

  return { url: post.url, fields: post.fields };
}
