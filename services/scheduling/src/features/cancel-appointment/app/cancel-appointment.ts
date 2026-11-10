import { type Appointment, type CancelAppointmentRequest, RoutingKeys } from '@mp/contracts';
import { createEvent } from '@mp/service-kit';
import {
  applyTransition,
  type AppointmentContext,
  toApiAppointment,
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
      createEvent({
        // Снапшот записи (6.2: письмо «отменена»; 5.4: previousStatus для проекции)
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        patientName: appointment.patientName,
        doctorId: appointment.doctorId,
        doctorName: appointment.doctorName,
        specializationName: appointment.specializationName,
        slot: {
          localDate: appointment.localDate,
          start: appointment.startTime,
          end: appointment.endTime,
        },
        previousStatus,
      }),
    );

    return toApiAppointment(appointment);
  });
}
