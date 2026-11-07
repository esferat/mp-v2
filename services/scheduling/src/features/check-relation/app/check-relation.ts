import type {
  DoctorByUserResponse,
  DoctorRelationQuery,
  DoctorRelationResponse,
} from '@mp/contracts';
import type { AppointmentRepository } from '../../../entities/appointment';
import {
  findDoctorByUser,
  type DoctorCatalogPort,
  type ScheduleCopyRepository,
} from '../../../entities/schedule-copy';
import { NotFoundError } from '../../../shared/model';

export interface CheckRelationDeps {
  appointments: AppointmentRepository;
  copies: ScheduleCopyRepository;
  /** Для re-import привязок созданных до 9.1 (fallback 3.5). */
  catalog?: DoctorCatalogPort;
}

/**
 * Связь «врач-пациент» (9.3): file-service спрашивает, есть ли у врача
 * (по Keycloak sub) ДЕЙСТВУЮЩАЯ запись с пациентом — APPROVED или COMPLETED.
 * Отменённая/отклонённая/ожидающая запись связи не даёт: доступ к документам
 * пациента закрывается (AC 9.3 «потеря связи закрывает доступ»).
 *
 * Врач не привязан (нет в копии расписания) → related=false (не ошибка:
 * файловый сервис превращает это в 403 с причиной).
 */
export async function checkDoctorRelation(
  deps: CheckRelationDeps,
  query: DoctorRelationQuery,
): Promise<DoctorRelationResponse> {
  const doctor = await findDoctorByUser(deps.copies, deps.catalog, query.userId);
  if (!doctor) return { related: false };

  const related = await deps.appointments.hasRelation(doctor.doctorId, query.patientId);
  return { related };
}

/**
 * Привязка sub → doctorId (9.3): file решает, свои ли файлы врача запрашиваются
 * (ownerType=DOCTOR, ownerId=doctorId). Привязки нет → 404 (вызывающий
 * трактует как «доступ только админу»).
 */
export async function getDoctorByUser(
  deps: CheckRelationDeps,
  userId: string,
): Promise<DoctorByUserResponse> {
  const doctor = await findDoctorByUser(deps.copies, deps.catalog, userId);
  if (!doctor) {
    throw new NotFoundError(`Врач с userId ${userId} не найден`);
  }
  return { doctorId: doctor.doctorId };
}
