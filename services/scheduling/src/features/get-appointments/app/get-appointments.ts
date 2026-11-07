import type { AppointmentListQuery, AppointmentListResponse } from '@mp/contracts';
import { toApiAppointment, type AppointmentRepository } from '../../../entities/appointment';

/**
 * Список записей с фильтрами и пагинацией (5.4): админский обзор —
 * только денализованные поля записи, без походов в справочники (design/appointments.md).
 */
export async function getAppointments(
  repository: AppointmentRepository,
  query: AppointmentListQuery,
): Promise<AppointmentListResponse> {
  const { items, total } = await repository.findPage({
    offset: query.offset,
    limit: query.limit,
    ...(query.status ? { status: query.status } : {}),
    ...(query.specId ? { specId: query.specId } : {}),
    ...(query.doctorId ? { doctorId: query.doctorId } : {}),
    ...(query.patientId ? { patientId: query.patientId } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
  });
  return { items: items.map(toApiAppointment), total };
}
