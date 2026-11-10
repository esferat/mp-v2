import type { RegisterDoctorRequest, RegisterDoctorResponse } from '@mp/contracts';
import {
  type CatalogDoctors,
  EmailExistsError,
  type UserDirectory,
} from '../../entities/registration';
import { ConflictError } from '../../shared/model';

/**
 * Сага создания врача с учётной записью (9.1):
 *
 *   A. пользователь Keycloak с ролью DOCTOR — идемпотентно по email
 *      (существующий пользователь переиспользуется: AC9.1 «повторное
 *      создание врача с тем же email не плодит пользователей»);
 *   B. catalog создаёт врача с userId — связка user ↔ doctor готова;
 *   компенсация: при сбое B созданный ЭТОЙ сагой пользователь удаляется
 *   (best-effort, чужой не трогаем) — «висячих» учёток не остаётся.
 *
 * Ядро знает только порты (hexagonal): Keycloak и HTTP скрыты в адаптерах.
 */
export interface RegisterDoctorSagaDeps {
  directory: UserDirectory;
  catalog: CatalogDoctors;
}

export async function registerDoctor(
  deps: RegisterDoctorSagaDeps,
  command: RegisterDoctorRequest,
): Promise<RegisterDoctorResponse> {
  const email = command.email.toLowerCase();

  // --- Шаг A: учётная запись Keycloak (роль DOCTOR) ------------------------
  let userId = await deps.directory.findByEmail(email);
  let createdOnThisSaga = false;

  if (!userId) {
    try {
      userId = await deps.directory.createUser({
        email,
        password: command.password,
        firstName: command.firstName,
        lastName: command.lastName,
        ...(command.middleName ? { middleName: command.middleName } : {}),
        realmRole: 'DOCTOR',
      });
      createdOnThisSaga = true;
    } catch (error) {
      if (!(error instanceof EmailExistsError)) throw error;
      // Гонка двойного submit: другой запрос успел первым — переиспользуем
      userId = await deps.directory.findByEmail(email);
      if (!userId) throw new ConflictError('Email уже зарегистрирован', { field: 'email' });
    }
  }

  // --- Шаг B: врач в catalog с привязкой userId ----------------------------
  // Идемпотентный повтор (9.1 AC): врач с этой учётной записью уже создан —
  // возвращаем существующего (иначе unique Doctor_userId_key → 500).
  const existingDoctor = await deps.catalog.findDoctorByUser(userId);
  if (existingDoctor) {
    return { userId, doctorId: existingDoctor.id };
  }

  try {
    const doctor = await deps.catalog.createDoctor({
      userId,
      firstName: command.firstName,
      lastName: command.lastName,
      ...(command.middleName ? { middleName: command.middleName } : {}),
      specializationId: command.specializationId,
      schedule: command.schedule,
    });
    return { userId, doctorId: doctor.id };
  } catch (error) {
    // Компенсация: удаляем только пользователя, созданного ЭТОЙ сагой
    if (createdOnThisSaga) {
      await deps.directory.deleteUser(userId);
    }
    throw error;
  }
}
