import type { FileListQuery, FileListResponse } from '@mp/contracts';
import { checkFileAccess, type AccessPorts, type AccessSubject } from '../../../entities/access';
import type { FileRepository } from '../../../entities/file';
import { ForbiddenError } from '../../../shared/model';

export interface ListFilesDeps {
  files: FileRepository;
  access: AccessPorts;
  log?: { warn(payload: Record<string, unknown>, message: string): void };
}

/**
 * Список файлов владельца (4.5/9.3): профиль пациента показывает свои
 * сканы, админ/врач — документы пациента. Права — ЕДИНАЯ проверка
 * checkFileAccess (та же, что у presigned/загрузки, DRY); отказ — 403 + лог.
 */
export async function listFiles(
  deps: ListFilesDeps,
  query: FileListQuery,
  subject: AccessSubject,
): Promise<FileListResponse> {
  const decision = await checkFileAccess(deps.access, subject, {
    ownerType: query.ownerType,
    ownerId: query.ownerId,
  });
  if (!decision.allowed) {
    deps.log?.warn(
      {
        subject: subject.sub,
        roles: subject.roles,
        ownerId: query.ownerId,
        reason: decision.reason,
      },
      'доступ к списку файлов отклонён',
    );
    throw new ForbiddenError(`Нет прав на файлы владельца: ${decision.reason}`);
  }

  const { items, total } = await deps.files.findByOwner(query.ownerType, query.ownerId);
  return { items, total };
}
