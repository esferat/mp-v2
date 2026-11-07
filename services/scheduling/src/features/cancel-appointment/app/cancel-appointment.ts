import { RoutingKeys, type Appointment, type CancelAppointmentRequest } from '@mp/contracts';
import { createEvent } from '@mp/service-kit';
import {
  applyTransition,
  toApiAppointment,
  type AppointmentContext,
} from '../../../entities/appointment';
import type { UnitOfWork } from '../../../entities/repository';

/**
 * Отмена записи (5.4): из SUBMITTED или APPROVED (канон §1), транзакция
 * «статус + событие» appointment.cancelled.v1 с previousStatus — проекция
 * отчёта знает, была ли запись учтена (−1 только из APPROVED).
 */
export async function cancelAppointment(
  unitOfWork: UnitOfWork<AppointmentContext>,
  id: string,
  request: CancelAppointmentRequest,
): Promise<Appointment> {
  return unitOfWork.run(async (context) => {
    const { appointment, previousStatus } = await applyTransition(
      context,
      id,
      'CANCELLED',
      request.reason ?? null,
    );

    await context.outbox.enqueue(
      RoutingKeys.AppointmentCancelled,
      createEvent({ appointmentId: appointment.id, previousStatus }),
    );

    return toApiAppointment(appointment);
  });
}
