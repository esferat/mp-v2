import type { DoctorListItem } from './doctor';

/**
 * Полезная нагрузка doctor.created.v1 / doctor.updated.v1 (3.5): снимок
 * карточки врача целиком. Единственный маппинг domain → event используют
 * и create-doctor, и update-doctor (DRY: знание о событии в одном месте).
 */
export function doctorEventPayload(doctor: DoctorListItem): {
  doctorId: string;
  userId?: string | null;
  status: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  specializationId: string;
  specializationName: string;
  schedule: DoctorListItem['schedule'];
  photoKey?: string;
} {
  return {
    doctorId: doctor.id,
    ...(doctor.userId !== undefined ? { userId: doctor.userId } : {}),
    status: doctor.status,
    firstName: doctor.firstName,
    lastName: doctor.lastName,
    ...(doctor.middleName ? { middleName: doctor.middleName } : {}),
    specializationId: doctor.specializationId,
    specializationName: doctor.specializationName,
    schedule: doctor.schedule,
    ...(doctor.photoKey ? { photoKey: doctor.photoKey } : {}),
  };
}
