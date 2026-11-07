import type { DocumentCategory, OwnerType } from '@mp/contracts';

/**
 * Домен реестра файлов (4.4): объект в MinIO + метаданные владельца.
 * Чистые типы без Prisma/HTTP (fsd.md §4.4).
 */

export interface FileMeta {
  readonly id: string;
  /** Плоский ключ объекта (один сегмент URL, без '/'). */
  readonly key: string;
  readonly bucket: string;
  readonly ownerType: OwnerType;
  readonly ownerId: string;
  /** MIME по магическим байтам (4.4: не доверяем Content-Type клиента). */
  readonly mime: string;
  readonly size: number;
  /** userId загрузившего (createdBy 4.4 / uploadedBy 9.3: одно поле). */
  readonly uploadedBy: string;
  readonly category?: DocumentCategory;
  /** ISO-время создания. */
  readonly createdAt: string;
}

export interface CreateFileData {
  key: string;
  bucket: string;
  ownerType: OwnerType;
  ownerId: string;
  mime: string;
  size: number;
  uploadedBy: string;
  category?: DocumentCategory;
}

/** Порт реестра (hexagonal: реализация — shared/api, тесты — in-memory). */
export interface FileRepository {
  findByKey(key: string): Promise<FileMeta | null>;
  create(data: CreateFileData): Promise<FileMeta>;
  /** Удаление записи; true — строка была (повтор безопасен). */
  deleteByKey(key: string): Promise<boolean>;
  /** Файлы владельца, новые сверху (4.5/9.3: списки документов). */
  findByOwner(ownerType: OwnerType, ownerId: string): Promise<{ items: FileMeta[]; total: number }>;
}

/** DI-токен привязки реализации (сборка — в app/app.module.ts). */
export const FILE_REPOSITORY = Symbol('FileFileRepository');
