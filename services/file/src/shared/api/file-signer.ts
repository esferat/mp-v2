import { createS3Client, loadStorageEnv, presignGet } from '@mp/storage';
import { Injectable } from '@nestjs/common';
import type { FileLinkSigner } from '../../entities/file';

/**
 * Адаптер presigned-ссылок (0.5/4.5): TTL — PRESIGNED_TTL_SECONDS (5 минут),
 * подпись включает bucket/key — по чужому ключу подпись не выдаётся
 * (проверка владельца происходит ДО подписи, в use-case).
 *
 * Подпись строится для MINIO_PUBLIC_ENDPOINT (браузерный хост), а не для
 * внутреннего minio:9000 — иначе ссылка нерешаема с хоста (AC 4.5).
 */
@Injectable()
export class S3FileLinkSigner implements FileLinkSigner {
  private readonly client = createS3Client({
    ...loadStorageEnv(),
    MINIO_ENDPOINT: loadStorageEnv().MINIO_PUBLIC_ENDPOINT,
  });

  async sign(bucket: string, key: string): Promise<{ url: string; expiresInSeconds: number }> {
    const expiresInSeconds = loadStorageEnv().PRESIGNED_TTL_SECONDS;
    const url = await presignGet(this.client, { bucket, key, expiresInSeconds });
    return { url, expiresInSeconds };
  }
}
