import { RoutingKeys, type CreatePatientRequest, type Patient } from '@mp/contracts';
import { createEvent } from '@mp/service-kit';
import type { PatientContext } from '../../../entities/patient';
import type { UnitOfWork } from '../../../entities/repository';

/**
 * Создание карточки пациента (1.4: шаг B саги регистрации).
 * Идемпотентно: повторный вызов с тем же userId возвращает существующую
 * карточку БЕЗ нового события (AC 1.4); новая карточка → patient.created.v1
 * в outbox одной транзакцией (4.6).
 */
export async function createPatient(
  unitOfWork: UnitOfWork<PatientContext>,
  command: CreatePatientRequest,
): Promise<Patient> {
  return unitOfWork.run(async (context) => {
    const existing = await context.patients.findByUserId(command.userId);
    if (existing) return existing;

    const created = await context.patients.createIfAbsent({
      userId: command.userId,
      email: command.email.toLowerCase(),
      firstName: command.firstName,
      lastName: command.lastName,
      ...(command.middleName ? { middleName: command.middleName } : {}),
      birthDate: command.birthDate,
    });

    await context.outbox.enqueue(
      RoutingKeys.PatientCreated,
      createEvent({
        patientId: created.id,
        userId: created.userId,
        firstName: created.firstName,
        lastName: created.lastName,
        ...(created.middleName ? { middleName: created.middleName } : {}),
        birthDate: created.birthDate,
        email: created.email,
      }),
    );

    return created;
  });
}
