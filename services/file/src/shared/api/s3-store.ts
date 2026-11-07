import { createS3Client, deleteObject, putObject } from '@mp/storage';
import type { ObjectStore } from '../../entities/file';

/**
 * Адаптер объектного хранилища (0.5/4.4): S3/MinIO через @mp/storage,
 * один клиент на процесс.
 */
export class S3ObjectStore implements ObjectStore {
  private readonly client = createS3Client();

  put(request: {
    bucket: string;
    key: string;
    body: Uint8Array;
    contentType: string;
  }): Promise<void> {
    return putObject(this.client, request);
  }

  remove(bucket: string, key: string): Promise<void> {
    return deleteObject(this.client, { bucket, key });
  }
}
