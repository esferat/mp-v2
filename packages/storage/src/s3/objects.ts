import { DeleteObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';

export interface PutObjectRequest {
  bucket: string;
  key: string;
  /** Тело файла: размер ограничен ДО загрузки (5 МБ, 4.4). */
  body: Uint8Array;
  contentType: string;
}

/**
 * Запись объекта в MinIO (4.4): вызывается ПЕРЕД записью в реестр;
 * при падении реестра объект удаляется (стратегия «сначала объект,
 * потом реестр» — см. upload-file).
 */
export async function putObject(client: S3Client, request: PutObjectRequest): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: request.bucket,
      Key: request.key,
      Body: request.body,
      ContentType: request.contentType,
    }),
  );
}

/**
 * Удаление объекта (4.4): идемпотентно — отсутствующий ключ не ошибка
 * (best-effort очистка при замене фото и после delete).
 */
export async function deleteObject(
  client: S3Client,
  request: { bucket: string; key: string },
): Promise<void> {
  try {
    await client.send(new DeleteObjectCommand({ Bucket: request.bucket, Key: request.key }));
  } catch (error) {
    if (isNotFound(error)) return;
    throw error;
  }
}

/** NoSuchKey / 404 — объекта уже нет (повтор удаления). */
function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const name = 'name' in error ? String(error.name) : '';
  if (name === 'NoSuchKey' || name === 'NotFound') return true;
  const metadata =
    '$metadata' in error
      ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata
      : undefined;
  return metadata?.httpStatusCode === 404;
}
