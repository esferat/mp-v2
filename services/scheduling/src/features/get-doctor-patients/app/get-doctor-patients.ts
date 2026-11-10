import type { DoctorPatientList } from '@mp/contracts';
import type { AppointmentRepository } from '../../../entities/appointment';
import {
  type DoctorCatalogPort,
  findDoctorByUser,
  type ScheduleCopyRepository,
} from '../../../entities/schedule-copy';
import type { AccessSubject } from '@mp/service-kit';
import { ForbiddenError } from '../../../shared/model';

export interface GetDoctorPatientsDeps {
  appointments: AppointmentRepository;
  copies: ScheduleCopyRepository;
  catalog?: DoctorCatalogPort;
}

/**
 * Пациенты врача (9.3): distinct из ЕГО записей (новые приёмы сверху) —
 * источник ИСТИНЫ назначений, без походов в patient-service.
 */
export async function getDoctorPatients(
  deps: GetDoctorPatientsDeps,
  subject: AccessSubject,
): Promise<DoctorPatientList> {
  const doctor = await findDoctorByUser(deps.copies, deps.catalog, subject.sub);
  if (!doctor) {
    throw new ForbiddenError('Учётная запись не привязана к карточке врача');
  }

  const items = await deps.appointments.findDistinctPatients(doctor.doctorId);
  return { items, total: items.length };
}
