import { RoutingKeys, type Patient, type UpdatePatientRequest } from '@mp/contracts';
import { createEvent } from '@mp/service-kit';
import { toPublicPatient, type PatientContext } from '../../../entities/patient';
import type { UnitOfWork } from '../../../entities/repository';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../shared/model';

/** Кто инициирует обновление (claims токена, 1.2/4.2). */
export interface UpdateSubject {
  sub: string;
  roles: readonly string[];
}

/**
 * Обновление карточки (4.2): id строго из пути, сверяется с телом
 * (расхождение → 400); доступ — ADMIN или владелец (USER, userId = sub),
 * иначе 403 (защита в глубину). Валидация: дата рождения не в будущем.
 * Транзакция: запись + событие patient.updated.v1 (4.6).
 */
export async function updatePatient(
  unitOfWork: UnitOfWork<PatientContext>,
  id: string,
  command: UpdatePatientRequest,
  subject: UpdateSubject,
): Promise<Patient> {
  if (command.id && command.id !== id) {
    throw new ValidationError('id в теле запроса не совпадает с путём', 'id');
  }

  const today = new Date().toISOString().slice(0, 10);
  if (command.birthDate > today) {
    throw new ValidationError('Дата рождения не может быть в будущем', 'birthDate');
  }

  return unitOfWork.run(async (context) => {
    const patient = await context.patients.findById(id);
    if (!patient) {
      throw new NotFoundError(`Пациент ${id} не найден`);
    }

    const isAdmin = subject.roles.includes('ADMIN');
    const isOwner = subject.roles.includes('USER') && patient.userId === subject.sub;
    if (!isAdmin && !isOwner) {
      throw new ForbiddenError('Карточка пациента недоступна этому пользователю');
    }

    const updated = await context.patients.update(id, {
      email: command.email,
      firstName: command.firstName,
      lastName: command.lastName,
      ...(command.middleName ? { middleName: command.middleName } : {}),
      birthDate: command.birthDate,
    });

    await context.outbox.enqueue(
      RoutingKeys.PatientUpdated,
      createEvent({
        patientId: updated.id,
        userId: updated.userId,
        firstName: updated.firstName,
        lastName: updated.lastName,
        ...(updated.middleName ? { middleName: updated.middleName } : {}),
        birthDate: updated.birthDate,
        email: updated.email,
      }),
    );

    return toPublicPatient(updated);
  });
}
