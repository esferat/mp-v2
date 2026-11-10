import type { AppointmentListQuery, AppointmentListResponse } from '@mp/contracts';
import { type AppointmentRepository, toApiAppointment } from '../../../entities/appointment';

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
    // Мультивыбор специализаций/врачей приоритетнее одиночных doctorId/specId
    ...(query.specIds?.length
      ? { specIds: query.specIds }
      : query.specId
        ? { specId: query.specId }
        : {}),
    ...(query.doctorIds?.length
      ? { doctorIds: query.doctorIds }
      : query.doctorId
        ? { doctorId: query.doctorId }
        : {}),
    ...(query.patientId ? { patientId: query.patientId } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
  });
  return { items: items.map(toApiAppointment), total };
}
