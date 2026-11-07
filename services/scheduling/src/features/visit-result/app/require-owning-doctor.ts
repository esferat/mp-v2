import type { Appointment, AppointmentRepository } from '../../../entities/appointment';
import {
  findDoctorByUser,
  type DoctorCatalogPort,
  type ScheduleCopyRepository,
} from '../../../entities/schedule-copy';
import type { AccessSubject } from '@mp/service-kit';
import { ForbiddenError, NotFoundError } from '../../../shared/model';

export interface OwningDoctorDeps {
  appointments: AppointmentRepository;
  copies: ScheduleCopyRepository;
  catalog?: DoctorCatalogPort;
}

/**
 * Доступ к результату приёма (9.2): «только врач записи» — doctorId
 * определяется по привязке sub → копия расписания (9.1 userId).
 * Возвращает запись, если она принадлежит врачу; иначе 403/404.
 */
export async function requireOwningDoctor(
  deps: OwningDoctorDeps,
  appointmentId: string,
  subject: AccessSubject,
): Promise<Appointment> {
  const doctor = await findDoctorByUser(deps.copies, deps.catalog, subject.sub);
  if (!doctor) {
    throw new ForbiddenError('Учётная запись не привязана к карточке врача');
  }

  const appointment = await deps.appointments.findById(appointmentId);
  if (!appointment) {
    throw new NotFoundError(`Запись ${appointmentId} не найдена`);
  }
  if (appointment.doctorId !== doctor.doctorId) {
    throw new ForbiddenError('Запись назначена другому врачу');
  }

  return appointment;
}
