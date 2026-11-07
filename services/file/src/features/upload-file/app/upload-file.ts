import { RoutingKeys } from '@mp/contracts';
import type { UploadFileFields, UploadFileResponse } from '@mp/contracts';
import { createEvent } from '@mp/service-kit';
import { bucketFor } from '@mp/storage';
import { checkFileAccess, type AccessPorts, type AccessSubject } from '../../../entities/access';
import {
  ALLOWED_MIMES,
  MAX_FILE_BYTES,
  buildFileKey,
  detectMime,
  type FileContext,
  type ObjectStore,
  type PhotoLinker,
} from '../../../entities/file';
import type { UnitOfWork } from '../../../entities/repository';
import { ForbiddenError, UpstreamError, ValidationError } from '../../../shared/model';

/** Минимальный логгер для best-effort компенсаций (критичные ошибки ловит фильтр). */
interface WarnLogger {
  warn(payload: Record<string, unknown>, message: string): void;
}

export interface UploadFileDeps {
  unitOfWork: UnitOfWork<FileContext>;
  store: ObjectStore;
  access: AccessPorts;
  photos: PhotoLinker;
  log?: WarnLogger;
}

export interface UploadFileCommand {
  fields: UploadFileFields;
  /** Файл из multer: размер уже ограничен лимитом интерсептора. */
  file: { buffer: Uint8Array };
  subject: AccessSubject;
}

/**
 * Загрузка файла (4.4/3.4). Порядок и стратегия согласованности:
 * 1) валидация (магические байты, MIME по виду, размер) и права владельца;
 * 2) объект в MinIO ПЕРЕД реестром: при падении реестра объект удаляется
 *    (компенсация, зафиксированная стратегия «сначала объект»);
 * 3) для фото: привязка к карточке (catalog/patient), старый ключ в ответе;
 * 4) транзакция: строка реестра + событие document.uploaded.v1 (атомарно);
 * 5) старое фото удаляется best-effort (объект и строка).
 * Сбой шага 3/4: новый объект убирается, фото возвращается на прежний ключ.
 */
export async function uploadFile(
  deps: UploadFileDeps,
  command: UploadFileCommand,
): Promise<UploadFileResponse> {
  const { fields, file, subject } = command;

  if (file.buffer.byteLength === 0) {
    throw new ValidationError('Передан пустой файл', 'file');
  }
  if (file.buffer.byteLength > MAX_FILE_BYTES) {
    throw new ValidationError('Файл больше 5 МБ', 'file');
  }
  if (fields.kind === 'DOCUMENT' && fields.ownerType !== 'PATIENT') {
    throw new ValidationError('Документы загружаются только пациенту', 'ownerType');
  }

  const mime = detectMime(file.buffer);
  if (!mime) {
    throw new ValidationError('Формат файла не распознан (допустимы JPEG, PNG, WebP, PDF)', 'file');
  }
  if (!ALLOWED_MIMES[fields.kind].includes(mime)) {
    throw new ValidationError(`Тип файла не подходит для вида ${fields.kind}`, 'file');
  }

  const decision = await checkFileAccess(deps.access, subject, {
    ownerType: fields.ownerType,
    ownerId: fields.ownerId,
  });
  if (!decision.allowed) {
    throw new ForbiddenError(`Нет прав на файл: ${decision.reason}`);
  }

  const bucket = bucketFor(fields.ownerType, fields.kind);
  const key = buildFileKey(mime);

  await deps.store.put({ bucket, key, body: file.buffer, contentType: mime });

  let previousKey: string | null = null;
  if (fields.kind === 'PHOTO') {
    try {
      const linked = await deps.photos.link(fields.ownerType, fields.ownerId, key);
      previousKey = linked.previousKey;
    } catch (error) {
      // Привязка не удалась: новый объект убираем, прежнее фото не тронуто
      await deps.store.remove(bucket, key).catch((cleanupError: unknown) => {
        deps.log?.warn({ err: cleanupError, key }, 'компенсация: удаление объекта не удалось');
      });
      throw error instanceof UpstreamError
        ? error
        : new UpstreamError('не удалось привязать фото к карточке');
    }
  }

  try {
    await deps.unitOfWork.run(async (context) => {
      await context.files.create({
        key,
        bucket,
        ownerType: fields.ownerType,
        ownerId: fields.ownerId,
        mime,
        size: file.buffer.byteLength,
        uploadedBy: subject.sub,
        ...(fields.category ? { category: fields.category } : {}),
      });
      await context.outbox.enqueue(
        RoutingKeys.DocumentUploaded,
        createEvent({
          key,
          bucket,
          ownerType: fields.ownerType,
          ownerId: fields.ownerId,
          mime,
          size: file.buffer.byteLength,
          uploadedBy: subject.sub,
          ...(fields.category ? { category: fields.category } : {}),
        }),
      );
    });
  } catch (error) {
    // Реестр не записан: объект убираем, фото возвращаем на прежний ключ
    await deps.store.remove(bucket, key).catch((cleanupError: unknown) => {
      deps.log?.warn({ err: cleanupError, key }, 'компенсация: удаление объекта не удалось');
    });
    if (fields.kind === 'PHOTO') {
      await deps.photos
        .link(fields.ownerType, fields.ownerId, previousKey)
        .catch((linkError: unknown) => {
          deps.log?.warn({ err: linkError, key }, 'компенсация: возврат прежнего фото не удался');
        });
    }
    throw error;
  }

  if (previousKey) {
    const staleKey = previousKey;
    await deps.store.remove(bucket, staleKey).catch((cleanupError: unknown) => {
      deps.log?.warn(
        { err: cleanupError, key: staleKey },
        'старое фото: удаление объекта не удалось',
      );
    });
    await deps.unitOfWork
      .run((context) => context.files.deleteByKey(staleKey))
      .catch((cleanupError: unknown) => {
        deps.log?.warn(
          { err: cleanupError, key: staleKey },
          'старое фото: строка реестра не удалена',
        );
      });
  }

  return { key, bucket, size: file.buffer.byteLength, mime };
}
