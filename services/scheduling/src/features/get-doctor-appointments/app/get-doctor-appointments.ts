import type { AppointmentListQuery, AppointmentListResponse } from '@mp/contracts';
import { type AppointmentRepository, toApiAppointment } from '../../../entities/appointment';
import {
  type DoctorCatalogPort,
  findDoctorByUser,
  type ScheduleCopyRepository,
} from '../../../entities/schedule-copy';
import type { AccessSubject } from '@mp/service-kit';
import { ForbiddenError } from '../../../shared/model';

export interface GetDoctorAppointmentsDeps {
  appointments: AppointmentRepository;
  copies: ScheduleCopyRepository;
  catalog?: DoctorCatalogPort;
}

/**
 * Приёмы врача (9.2): doctorId ОПРЕДЕЛЯЕТСЯ по привязке sub → копия
 * расписания (9.1 userId) и подменяет любые параметры запроса — врач видит
 * только СВОИ записи (AC 9.2). Фильтры: период/статус/пагинация из query;
 * patientId — «приёмы своего пациента» в карточке пациента врача (9.3),
 * всегда в связке с врачом — чужие записи недоступны.
 */
export async function getDoctorAppointments(
  deps: GetDoctorAppointmentsDeps,
  query: AppointmentListQuery,
  subject: AccessSubject,
): Promise<AppointmentListResponse> {
  const doctor = await findDoctorByUser(deps.copies, deps.catalog, subject.sub);
  if (!doctor) {
    throw new ForbiddenError('Учётная запись не привязана к карточке врача');
  }

  const { items, total } = await deps.appointments.findPage({
    offset: query.offset,
    limit: query.limit,
    doctorId: doctor.doctorId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
    ...(query.patientId ? { patientId: query.patientId } : {}),
  });

  return { items: items.map(toApiAppointment), total };
}
