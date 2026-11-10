import type { FileDownload } from '@mp/contracts';
import { type AccessPorts, type AccessSubject, checkFileAccess } from '../../../entities/access';
import type { FileLinkSigner, FileRepository } from '../../../entities/file';
import { ForbiddenError, NotFoundError } from '../../../shared/model';

export interface GetFileLinkDeps {
  files: FileRepository;
  access: AccessPorts;
  signer: FileLinkSigner;
  log?: { warn(payload: Record<string, unknown>, message: string): void };
}

/**
 * Presigned-ссылка на скачивание (4.5): ключ ПРОВЕРЯЕТСЯ по реестру
 * (чужой/неизвестный ключ → 404, не битая ссылка), затем ЕДИНАЯ проверка
 * прав (та же функция, что у загрузки/удаления — DRY; расширение врача в 9.3).
 * Отказы логируются с subject/key/reason (AC 4.5).
 */
export async function getFileLink(
  deps: GetFileLinkDeps,
  key: string,
  subject: AccessSubject,
): Promise<FileDownload> {
  const file = await deps.files.findByKey(key);
  if (!file) {
    throw new NotFoundError(`Файл ${key} не найден в реестре`);
  }

  const decision = await checkFileAccess(deps.access, subject, {
    ownerType: file.ownerType,
    ownerId: file.ownerId,
  });
  if (!decision.allowed) {
    deps.log?.warn(
      { subject: subject.sub, roles: subject.roles, key, reason: decision.reason },
      'доступ к файлу отклонён',
    );
    throw new ForbiddenError(`Нет прав на файл: ${decision.reason}`);
  }

  return deps.signer.sign(file.bucket, file.key);
}
