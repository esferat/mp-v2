import { BUCKETS, createS3Client, presignGet } from '@mp/storage';
import { Injectable } from '@nestjs/common';
import type { PhotoUrlSigner } from '../../entities/doctor';

/**
 * Адаптер подписи фото (0.5/3.1): presigned GET на бакет doctor-photos,
 * TTL — PRESIGNED_TTL_SECONDS (5 минут по умолчанию).
 */
@Injectable()
export class PhotoUrlSignerAdapter implements PhotoUrlSigner {
  private readonly client = createS3Client();

  async sign(photoKey: string): Promise<string> {
    return presignGet(this.client, { bucket: BUCKETS.doctorPhotos, key: photoKey });
  }
}
