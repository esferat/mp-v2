import type { AppointmentListQuery, AppointmentListResponse, Patient } from '@mp/contracts';
import { toApiAppointment, type AppointmentRepository } from '../../../entities/appointment';

/** Минимальный порт пациентов (реализация — shared/api patient-клиент). */
export interface MyAppointmentsPatientPort {
  findByUser(userId: string): Promise<Patient | null>;
}

export interface GetMyAppointmentsDeps {
  appointments: AppointmentRepository;
  patients: MyAppointmentsPatientPort;
}

/**
 * История записей пациента (5.5): patientId определяется ПО ТОКЕНУ (sub) и
 * ПРИНУДИТЕЛЬНО подменяет любое значение из запроса — чужую историю получить
 * нельзя (AC 5.5). Прочие фильтры (статус/специализация/период) — из запроса.
 * Без карточки — пустая история, не ошибка.
 */
export async function getMyAppointments(
  deps: GetMyAppointmentsDeps,
  userSub: string,
  query: AppointmentListQuery,
): Promise<AppointmentListResponse> {
  const patient = await deps.patients.findByUser(userSub);
  if (!patient) return { items: [], total: 0 };

  const { items, total } = await deps.appointments.findPage({
    offset: query.offset,
    limit: query.limit,
    // Строго своя карточка: patientId запроса ИГНОРИРУЕТСЯ (5.5 AC)
    patientId: patient.id,
    ...(query.status ? { status: query.status } : {}),
    ...(query.specId ? { specId: query.specId } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
  });
  return { items: items.map(toApiAppointment), total };
}
