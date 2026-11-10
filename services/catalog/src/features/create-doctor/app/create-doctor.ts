import { type CreateDoctorRequest, type DoctorListItem, RoutingKeys } from '@mp/contracts';
import { createEvent } from '@mp/service-kit';
import { type DoctorContext, doctorEventPayload } from '../../../entities/doctor';
import type { SpecializationRepository } from '../../../entities/specialization';
import type { UnitOfWork } from '../../../entities/repository';
import { validateSchedule } from '../../../entities/schedule';
import { ValidationError } from '../../../shared/model';

/**
 * Создание врача (3.2): доменная валидация расписания (400 с полем, не 500)
 * -> существование специализации (порт справочника приходит отдельно,
 * граница FSD) -> запись и событие doctor.created.v1 в одной транзакции
 * (outbox, 0.9/3.5).
 */
export async function createDoctor(
  unitOfWork: UnitOfWork<DoctorContext>,
  specializations: SpecializationRepository,
  command: CreateDoctorRequest,
): Promise<DoctorListItem> {
  const issue = validateSchedule(command.schedule);
  if (issue) throw new ValidationError(issue.message, issue.field);

  return unitOfWork.run(async (context) => {
    const specialization = await specializations.findById(command.specializationId);
    if (!specialization) {
      throw new ValidationError('Специализация не найдена', 'specializationId');
    }

    const doctor = await context.doctors.create({
      ...(command.userId ? { userId: command.userId } : {}),
      firstName: command.firstName,
      lastName: command.lastName,
      ...(command.middleName ? { middleName: command.middleName } : {}),
      specializationId: command.specializationId,
      schedule: command.schedule,
    });

    await context.outbox.enqueue(
      RoutingKeys.DoctorCreated,
      createEvent(doctorEventPayload(doctor)),
    );

    return doctor;
  });
}
