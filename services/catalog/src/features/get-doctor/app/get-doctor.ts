import {
  toPublicDoctor,
  type DoctorListItem,
  type DoctorRepository,
  type PhotoUrlSigner,
} from '../../../entities/doctor';
import { NotFoundError } from '../../../shared/model';

/**
 * Карточка врача по id (3.2): форма редактирования, ответ 404 для
 * несуществующего id. photoKey заменяется на presigned photoUrl
 * (DRY — общая toPublicDoctor).
 */
export async function getDoctor(
  repository: DoctorRepository,
  signer: PhotoUrlSigner | undefined,
  id: string,
): Promise<DoctorListItem> {
  const doctor = await repository.findById(id);
  if (!doctor) {
    throw new NotFoundError(`Врач ${id} не найден`);
  }
  return toPublicDoctor(doctor, signer);
}

/**
 * Карточка врача по Keycloak sub (9.1): идемпотентный повтор саги
 * находит существующего врача по привязке userId.
 */
export async function getDoctorByUser(
  repository: DoctorRepository,
  signer: PhotoUrlSigner | undefined,
  userId: string,
): Promise<DoctorListItem> {
  const doctor = await repository.findByUserId(userId);
  if (!doctor) {
    throw new NotFoundError(`Врач с userId ${userId} не найден`);
  }
  return toPublicDoctor(doctor, signer);
}
