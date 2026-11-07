import type { PatientListItem, PatientListQuery, PatientListResponse } from '@mp/contracts';
import {
  toPublicPatient,
  type PatientRepository,
  type PhotoUrlSigner,
} from '../../../entities/patient';

/**
 * Админский список пациентов (4.1): пагинация и поиск по ФИО/email в
 * репозитории (p95 < 200 мс на 10⁴ карточек — ILIKE по проиндексированным
 * по умолчанию колонкам), photoUrl — presigned при выдаче (TTL 5 мин).
 */
export async function getPatients(
  repository: PatientRepository,
  signer: PhotoUrlSigner | undefined,
  query: PatientListQuery,
): Promise<PatientListResponse> {
  const { items, total } = await repository.findPage({
    offset: query.offset,
    limit: query.limit,
    ...(query.search ? { search: query.search } : {}),
  });

  const mapped = await Promise.all(
    items.map(async (patient): Promise<PatientListItem> => {
      const base = toPublicPatient(patient);
      const photoUrl = patient.photoKey && signer ? await signer.sign(patient.photoKey) : undefined;
      return {
        id: base.id,
        userId: base.userId,
        firstName: base.firstName,
        lastName: base.lastName,
        ...(base.middleName ? { middleName: base.middleName } : {}),
        birthDate: base.birthDate,
        email: base.email,
        registrationDate: base.registeredAt.slice(0, 10),
        ...(photoUrl ? { photoUrl } : {}),
      };
    }),
  );

  return { items: mapped, total };
}
