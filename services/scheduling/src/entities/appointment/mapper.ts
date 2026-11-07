import type { Appointment as ContractAppointment } from '@mp/contracts';
import type { Appointment } from './appointment';

/**
 * Маппинг записи в контракт HTTP (5.3/5.4): домен хранит слот плоскими
 * колонками (localDate/startTime/endTime — удобно фильтровать и индексировать),
 * контракт отдаёт вложенный `slot` (appointmentSchema).
 */
export function toApiAppointment(appointment: Appointment): ContractAppointment {
  return {
    id: appointment.id,
    status: appointment.status,
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
    ...(appointment.declineReason ? { declineReason: appointment.declineReason } : {}),
    ...(appointment.visitResult ? { visitResult: appointment.visitResult } : {}),
    createdAt: appointment.createdAt,
  };
}
