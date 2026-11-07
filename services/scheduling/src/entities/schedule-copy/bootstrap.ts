import type { DoctorListItem } from '@mp/contracts';
import type { DoctorEventData, DoctorScheduleCopy, ScheduleCopyRepository } from './schedule-copy';

/**
 * Копия врача по Keycloak sub (9.2/9.3): первичный путь — поле userId в
 * копии (заполняется из doctor.* событий и bootstrap). Если привязки нет
 * (копии созданы до 9.1) — выполняется однократный re-import из catalog
 * с логом-предупреждением вызывающей стороны (fallback 3.5).
 */
export async function findDoctorByUser(
  repository: ScheduleCopyRepository,
  catalog: DoctorCatalogPort | undefined,
  userId: string,
): Promise<DoctorScheduleCopy | null> {
  const copy = await repository.findByUserId(userId);
  if (copy) return copy;
  if (!catalog) return null;

  await importCopiesFromCatalog(repository, catalog);
  return repository.findByUserId(userId);
}

/**
 * Bootstrap копий расписаний (5.1): при пустом read-model (первый запуск,
 * БД потеряна) копии импортируются из catalog REST, чтобы слоты не ждали
 * событий. occurredAt = epoch: ЛЮБОЕ последующее событие новее импорта
 * и применится (события — источник истины).
 *
 * Та же функция служит fallback'ом при расхождении (3.5: специализация
 * без копий → синхронный запрос catalog с логом предупреждения).
 */
export const BOOTSTRAP_EPOCH = '1970-01-01T00:00:00.000Z';

/** Минимальный порт каталога для импорта (реализация — shared/api). */
export interface DoctorCatalogPort {
  listDoctors(limit?: number): Promise<DoctorListItem[]>;
}

export async function importCopiesFromCatalog(
  repository: ScheduleCopyRepository,
  catalog: DoctorCatalogPort,
): Promise<{ imported: number }> {
  const doctors = await catalog.listDoctors();

  let imported = 0;
  for (const doctor of doctors) {
    const data: DoctorEventData = {
      doctorId: doctor.id,
      userId: doctor.userId ?? null,
      specializationId: doctor.specializationId,
      specializationName: doctor.specializationName,
      lastName: doctor.lastName,
      firstName: doctor.firstName,
      ...(doctor.middleName ? { middleName: doctor.middleName } : {}),
      status: doctor.status,
      schedule: doctor.schedule,
      occurredAt: BOOTSTRAP_EPOCH,
    };
    const result = await repository.applyDoctorEvent(data);
    if (result.applied) imported += 1;
  }

  return { imported };
}
