import { RoutingKeys, type SetPhotoResponse } from '@mp/contracts';
import { createEvent } from '@mp/service-kit';
import { type DoctorContext, doctorEventPayload } from '../../../entities/doctor';
import type { UnitOfWork } from '../../../entities/repository';
import { NotFoundError } from '../../../shared/model';

/**
 * Привязка фото врача (3.4): внутренний маршрут file → catalog после
 * успешной загрузки (svc-file). Возвращает прежний ключ для очистки
 * старого объекта; key = null очищает фото.
 *
 * Публикуется doctor.updated.v1 (3.5: каждое изменение карточки идёт через
 * outbox; отдельного doctor.photo.changed в каталоге событий нет).
 */
export async function setDoctorPhoto(
  unitOfWork: UnitOfWork<DoctorContext>,
  id: string,
  key: string | null,
): Promise<SetPhotoResponse> {
  return unitOfWork.run(async (context) => {
    const doctor = await context.doctors.findById(id);
    if (!doctor) {
      throw new NotFoundError(`Врач ${id} не найден`);
    }

    const previousKey = doctor.photoKey ?? null;
    const updated = await context.doctors.setPhoto(id, key);
    if (!updated) {
      throw new NotFoundError(`Врач ${id} не найден`);
    }

    await context.outbox.enqueue(
      RoutingKeys.DoctorUpdated,
      createEvent(doctorEventPayload(updated)),
    );

    return { previousKey };
  });
}
