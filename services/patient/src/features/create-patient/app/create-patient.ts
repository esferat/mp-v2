import type { CreatePatientRequest, Patient } from '@mp/contracts';
import type { PatientRepository } from '../../../entities/patient';

/**
 * Создание карточки пациента (1.4: шаг B саги регистрации).
 * Идемпотентно: повторный вызов с тем же userId возвращает существующую
 * карточку — двойной submit не создаёт дублей (AC 1.4).
 */
export async function createPatient(
  repository: PatientRepository,
  command: CreatePatientRequest,
): Promise<Patient> {
  return repository.createIfAbsent({
    userId: command.userId,
    email: command.email.toLowerCase(),
    firstName: command.firstName,
    lastName: command.lastName,
    ...(command.middleName ? { middleName: command.middleName } : {}),
    birthDate: command.birthDate,
  });
}
