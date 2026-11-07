import { bucketFor, createS3Client, loadStorageEnv, presignGet } from '@mp/storage';
import { Injectable } from '@nestjs/common';
import type { PhotoUrlSigner } from '../../entities/patient';

/**
 * Адаптер подписи фото пациента (0.5/4.1): presigned GET бакета patient-photos,
 * TTL — PRESIGNED_TTL_SECONDS (5 минут по умолчанию).
 *
 * Подпись строится для MINIO_PUBLIC_ENDPOINT (браузерный хост) — ссылка
 * должна открываться из браузера, а не только внутри сети compose.
 */
@Injectable()
export class PatientPhotoUrlSigner implements PhotoUrlSigner {
  private readonly client = createS3Client({
    ...loadStorageEnv(),
    MINIO_ENDPOINT: loadStorageEnv().MINIO_PUBLIC_ENDPOINT,
  });

  async sign(photoKey: string): Promise<string> {
    return presignGet(this.client, {
      bucket: bucketFor('PATIENT', 'PHOTO'),
      key: photoKey,
    });
  }
}
