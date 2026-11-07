/**
 * Порт объектного хранилища (4.4): реализация — shared/api (S3/MinIO),
 * тесты — in-memory. Размер файла ограничивается ДО вызова (MAX_FILE_BYTES).
 */
export interface ObjectStore {
  put(request: {
    bucket: string;
    key: string;
    body: Uint8Array;
    contentType: string;
  }): Promise<void>;
  /** Идемпотентно: отсутствующий ключ не ошибка. */
  remove(bucket: string, key: string): Promise<void>;
}

/** DI-токен привязки реализации (сборка — в app/app.module.ts). */
export const OBJECT_STORE = Symbol('FileObjectStore');
