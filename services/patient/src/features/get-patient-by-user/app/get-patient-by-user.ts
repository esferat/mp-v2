import { NotFoundError } from '../../../shared/model';
import type { Patient } from '../../../entities/patient';
import type { PatientRepository } from '../../../entities/patient';

/**
 * Чтение карточки по Keycloak `sub` (1.4: шаг B саги проверяет,
 * дособрать ли карточку). Нет карточки → NotFoundError (404).
 */
export async function getPatientByUser(
  repository: PatientRepository,
  userId: string,
): Promise<Patient> {
  const patient = await repository.findByUserId(userId);
  if (!patient) {
    throw new NotFoundError(`Пациент с userId ${userId} не найден`);
  }
  return patient;
}
