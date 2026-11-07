import type { OwnerType } from '@mp/contracts';

/**
 * Порт привязки фото к карточке владельца (3.4/4.3): file после загрузки
 * сообщает catalog/patient новый ключ и получает прежний для очистки.
 * Ключ null означает «очистить фото» (нужно для компенсации).
 */
export interface PhotoLinker {
  link(
    ownerType: OwnerType,
    ownerId: string,
    key: string | null,
  ): Promise<{ previousKey: string | null }>;
}

/** DI-токен привязки реализации (сборка — в app/app.module.ts). */
export const PHOTO_LINKER = Symbol('FilePhotoLinker');
