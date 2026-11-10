import { type Appointment, RoutingKeys, type SetAppointmentStatusRequest } from '@mp/contracts';
import { createEvent } from '@mp/service-kit';
import {
  applyTransition,
  type AppointmentContext,
  appointmentEventPayload,
  toApiAppointment,
} from '../../../entities/appointment';
import type { UnitOfWork } from '../../../entities/repository';
import { ValidationError } from '../../../shared/model';

/**
 * Приём/отклонение записи (5.4): только из SUBMITTED (канон §1), транзакция
 * «статус + событие» (appointment.approved/declined.v1). Недопустимый переход
 * и повтор команды → 409 без изменения БД (AC 5.4).
 */
export async function setAppointmentStatus(
  unitOfWork: UnitOfWork<AppointmentContext>,
  id: string,
  request: SetAppointmentStatusRequest,
): Promise<Appointment> {
  // Канон §1: отклонение обязательно с причиной (доменное правило, 5.4)
  if (request.status === 'DECLINED' && !request.reason) {
    throw new ValidationError('Укажите причину отклонения', 'reason');
  }

  return unitOfWork.run(async (context) => {
    const { appointment } = await applyTransition(
      context,
      id,
      request.status,
      request.reason ?? null,
    );

    const payload =
      request.status === 'APPROVED'
        ? appointmentEventPayload(appointment)
        : {
            ...appointmentEventPayload(appointment),
            ...(request.reason ? { reason: request.reason } : {}),
          };

    await context.outbox.enqueue(
      request.status === 'APPROVED'
        ? RoutingKeys.AppointmentApproved
        : RoutingKeys.AppointmentDeclined,
      createEvent(payload),
    );

    return toApiAppointment(appointment);
  });
}
