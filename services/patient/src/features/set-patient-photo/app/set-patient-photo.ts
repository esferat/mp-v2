import type { SetPhotoResponse } from '@mp/contracts';
import type { PatientRepository } from '../../../entities/patient';
import { NotFoundError } from '../../../shared/model';

/**
 * Привязка фото к карточке пациента (4.3): вызывается file-service после
 * успешной загрузки (svc-file, внутренний маршрут). Возвращает прежний
 * ключ, чтобы file удалил старый объект; key = null очищает фото
 * (компонент компенсации при сбое транзакции загрузки).
 *
 * Событие patient.updated.v1 здесь НЕ публикуется: photoKey отсутствует
 * в полезной нагрузке контракта (зафиксировано в 4.3/4.6).
 */
export async function setPatientPhoto(
  repository: PatientRepository,
  id: string,
  key: string | null,
): Promise<SetPhotoResponse> {
  const patient = await repository.findById(id);
  if (!patient) {
    throw new NotFoundError(`Пациент ${id} не найден`);
  }

  const previousKey = patient.photoKey ?? null;
  await repository.setPhoto(id, key);
  return { previousKey };
}
