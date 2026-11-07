import { RoutingKeys, type DoctorListItem, type UpdateDoctorRequest } from '@mp/contracts';
import { createEvent } from '@mp/service-kit';
import { doctorEventPayload, type DoctorContext } from '../../../entities/doctor';
import type { SpecializationRepository } from '../../../entities/specialization';
import type { UnitOfWork } from '../../../entities/repository';
import { validateSchedule } from '../../../entities/schedule';
import { NotFoundError, ValidationError } from '../../../shared/model';

/**
 * Редактирование врача (3.2): id строго из пути, сверяется с телом
 * (расхождение -> 400, прямой PUT с чужим id не обновляет молча); далее
 * как в create (валидация -> специализация -> транзакция + doctor.updated.v1).
 *
 * Снимки прошлых записей пациентов (ФИО врача, специализация) в scheduling
 * НЕ переписываются здесь: они обновляются только событиями в копиях (5.1),
 * история приёмов хранит собственный снапшот (5.4).
 */
export async function updateDoctor(
  unitOfWork: UnitOfWork<DoctorContext>,
  specializations: SpecializationRepository,
  id: string,
  command: UpdateDoctorRequest,
): Promise<DoctorListItem> {
  if (command.id && command.id !== id) {
    throw new ValidationError('id в теле запроса не совпадает с путём', 'id');
  }

  const issue = validateSchedule(command.schedule);
  if (issue) throw new ValidationError(issue.message, issue.field);

  return unitOfWork.run(async (context) => {
    const existing = await context.doctors.findById(id);
    if (!existing) {
      throw new NotFoundError(`Врач ${id} не найден`);
    }

    const specialization = await specializations.findById(command.specializationId);
    if (!specialization) {
      throw new ValidationError('Специализация не найдена', 'specializationId');
    }

    const doctor = await context.doctors.update(id, {
      firstName: command.firstName,
      lastName: command.lastName,
      ...(command.middleName ? { middleName: command.middleName } : {}),
      specializationId: command.specializationId,
      schedule: command.schedule,
      ...(command.status ? { status: command.status } : {}),
    });

    await context.outbox.enqueue(
      RoutingKeys.DoctorUpdated,
      createEvent(doctorEventPayload(doctor)),
    );

    return doctor;
  });
}
