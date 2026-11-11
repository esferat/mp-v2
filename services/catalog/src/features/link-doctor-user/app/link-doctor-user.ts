import type { DoctorListItem, LinkDoctorUserRequest } from '@mp/contracts';
import { createEvent } from '@mp/service-kit';
import { RoutingKeys } from '@mp/contracts';
import { type DoctorContext, doctorEventPayload } from '../../../entities/doctor';
import type { UnitOfWork } from '../../../entities/repository';
import { ConflictError, NotFoundError } from '../../../shared/model';

/**
 * Привязка учётной записи (Keycloak sub) к существующему карточке врача —
 * правило «учётная запись создаётся администратором всегда»: сага identity
 * создаёт пользователя, здесь карточка получает userId (шаг B).
 *
 * - идемпотентно: повтор с тем же userId — no-op (повторная отправка формы);
 * - привязка уже занята (карточка или userId у другого врача) → 409 —
 *   молча перепривязывать нельзя (unique Doctor_userId_key);
 * - снимки прошлых записей пациентов не переписываются (как в update 3.2).
 */
export async function linkDoctorUser(
  unitOfWork: UnitOfWork<DoctorContext>,
  id: string,
  command: LinkDoctorUserRequest,
): Promise<DoctorListItem> {
  return unitOfWork.run(async (context) => {
    const existing = await context.doctors.findById(id);
    if (!existing) {
      throw new NotFoundError(`Врач ${id} не найден`);
    }

    if (existing.userId === command.userId) {
      return existing; // идемпотентный повтор
    }
    if (existing.userId) {
      throw new ConflictError('У врача уже есть учётная запись', { field: 'userId' });
    }
    const bound = await context.doctors.findByUserId(command.userId);
    if (bound) {
      throw new ConflictError('Учётная запись уже привязана к другому врачу', { field: 'email' });
    }

    // update c полным снимком: существующий интерфейс репозитория покрывает
    // установку userId (toRowData передаёт колонку, когда поле определено)
    const doctor = await context.doctors.update(id, {
      userId: command.userId,
      firstName: existing.firstName,
      lastName: existing.lastName,
      ...(existing.middleName ? { middleName: existing.middleName } : {}),
      specializationId: existing.specializationId,
      schedule: existing.schedule,
      status: existing.status,
    });

    await context.outbox.enqueue(
      RoutingKeys.DoctorUpdated,
      createEvent(doctorEventPayload(doctor)),
    );

    return doctor;
  });
}
