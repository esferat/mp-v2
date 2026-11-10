import type { Patient } from '@mp/contracts';
import {
  type PatientRepository,
  type PhotoUrlSigner,
  toPublicPatient,
} from '../../../entities/patient';
import { NotFoundError } from '../../../shared/model';

/**
 * Чтение карточки по Keycloak `sub` (1.4: шаг B саги проверяет,
 * дособрать ли карточку). Нет карточки → NotFoundError (404).
 *
 * `photoUrl` — presigned-аватар (3.4/4.3): нужен профилю пациента, чтобы
 * отображать и обновлять фото (подпись — PhotoUrlSigner, как в списке).
 */
export async function getPatientByUser(
  repository: PatientRepository,
  userId: string,
  signer?: PhotoUrlSigner,
): Promise<Patient> {
  const patient = await repository.findByUserId(userId);
  if (!patient) {
    throw new NotFoundError(`Пациент с userId ${userId} не найден`);
  }
  const publicPatient = toPublicPatient(patient);
  const photoUrl = patient.photoKey && signer ? await signer.sign(patient.photoKey) : undefined;
  return { ...publicPatient, ...(photoUrl ? { photoUrl } : {}) };
}
