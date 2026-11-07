import type { Appointment } from './appointment';

/**
 * Полезные нагрузки appointment.*.v1 (5.3/5.4): денализованные поля записи.
 * Единственный маппинг domain → event (DRY для book/set/cancel/completed).
 */
export function appointmentEventPayload(appointment: Appointment): {
  appointmentId: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  specializationName: string;
  slot: { localDate: string; start: string; end: string };
} {
  return {
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
  };
}
