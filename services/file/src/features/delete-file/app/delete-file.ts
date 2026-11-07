import { RoutingKeys } from '@mp/contracts';
import { createEvent } from '@mp/service-kit';
import { checkFileAccess, type AccessPorts, type AccessSubject } from '../../../entities/access';
import type { FileContext, ObjectStore } from '../../../entities/file';
import type { UnitOfWork } from '../../../entities/repository';
import { ForbiddenError, NotFoundError } from '../../../shared/model';

interface WarnLogger {
  warn(payload: Record<string, unknown>, message: string): void;
}

export interface DeleteFileDeps {
  unitOfWork: UnitOfWork<FileContext>;
  store: ObjectStore;
  access: AccessPorts;
  log?: WarnLogger;
}

/**
 * Удаление файла (4.4): реестр и событие document.deleted.v1 атомарны,
 * объект в MinIO удаляется ПОСЛЕ commit best-effort (стратегия «сначала
 * реестр, потом объект»: при падении очистки остаётся объект-сирота,
 * который виден только по ключу, строка и событие консистентны).
 *
 * Повтор: ключа в реестре нет → 404, вторая попытка безопасна.
 */
export async function deleteFile(
  deps: DeleteFileDeps,
  key: string,
  subject: AccessSubject,
): Promise<void> {
  const file = await deps.unitOfWork.run((context) => context.files.findByKey(key));
  if (!file) {
    throw new NotFoundError(`Файл ${key} не найден в реестре`);
  }

  const decision = await checkFileAccess(deps.access, subject, {
    ownerType: file.ownerType,
    ownerId: file.ownerId,
  });
  if (!decision.allowed) {
    throw new ForbiddenError(`Нет прав на файл: ${decision.reason}`);
  }

  await deps.unitOfWork.run(async (context) => {
    const removed = await context.files.deleteByKey(key);
    // Гонка двух удалений: событие пишет только тот, кто удалил строку
    if (removed) {
      await context.outbox.enqueue(
        RoutingKeys.DocumentDeleted,
        createEvent({
          key,
          ownerType: file.ownerType,
          ownerId: file.ownerId,
        }),
      );
    }
  });

  await deps.store.remove(file.bucket, key).catch((error: unknown) => {
    deps.log?.warn({ err: error, key, bucket: file.bucket }, 'объект не удалён (осиротевший ключ)');
  });
}
