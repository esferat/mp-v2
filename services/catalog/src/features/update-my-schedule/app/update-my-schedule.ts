import { type DoctorListItem, RoutingKeys, type UpdateDoctorScheduleRequest } from '@mp/contracts';
import { createEvent } from '@mp/service-kit';
import { type DoctorContext, doctorEventPayload } from '../../../entities/doctor';
import type { UnitOfWork } from '../../../entities/repository';
import { validateSchedule } from '../../../entities/schedule';
import { NotFoundError, ValidationError } from '../../../shared/model';

/**
 * Расписание врача (10.4, Этап 2.1): врач правит ТОЛЬКО расписание своей
 * карточки — id резолвится по sub из токена (findByUserId), чужой врач
 * недоступен (нет id в запросе — править нечего). Валидация расписания —
 * та же, что в 3.2 (entities/schedule): 400 с полем, не 500.
 *
 * Событие doctor.updated.v1 уходит как в админском update-doctor: scheduling
 * обновляет копию расписания (5.1) и пересчитывает свободные слоты (< 5 с).
 */
export async function updateMySchedule(
  unitOfWork: UnitOfWork<DoctorContext>,
  command: UpdateDoctorScheduleRequest,
  subject: { sub: string },
): Promise<DoctorListItem> {
  const issue = validateSchedule(command.schedule);
  if (issue) throw new ValidationError(issue.message, issue.field);

  return unitOfWork.run(async (context) => {
    const existing = await context.doctors.findByUserId(subject.sub);
    if (!existing) {
      throw new NotFoundError('Врач с вашей учётной записью не найден');
    }

    const doctor = await context.doctors.updateSchedule(existing.id, command.schedule);

    await context.outbox.enqueue(
      RoutingKeys.DoctorUpdated,
      createEvent(doctorEventPayload(doctor)),
    );

    return doctor;
  });
}
