import type {
  CreateDoctorAccountRequest,
  RegisterDoctorRequest,
  RegisterDoctorResponse,
} from '@mp/contracts';
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
 *
 * Шаг A общий с сагой `createDoctorAccount` (правило «учётная запись
 * создаётся администратором всегда»): там шаг B — привязка userId к уже
 * существующей карточке вместо создания новой.
 */
export interface RegisterDoctorSagaDeps {
  directory: UserDirectory;
  catalog: CatalogDoctors;
}

/** Учётная запись Keycloak (шаг A): email → userId; created — создана здесь. */
async function ensureUser(
  directory: UserDirectory,
  command: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    middleName?: string;
  },
): Promise<{ userId: string; created: boolean }> {
  const email = command.email.toLowerCase();

  const userId = await directory.findByEmail(email);
  if (userId) return { userId, created: false };

  try {
    const created = await directory.createUser({
      email,
      password: command.password,
      firstName: command.firstName,
      lastName: command.lastName,
      ...(command.middleName ? { middleName: command.middleName } : {}),
      realmRole: 'DOCTOR',
    });
    return { userId: created, created: true };
  } catch (error) {
    if (!(error instanceof EmailExistsError)) throw error;
    // Гонка двойного submit: другой запрос успел первым — переиспользуем
    const raced = await directory.findByEmail(email);
    if (!raced) throw new ConflictError('Email уже зарегистрирован', { field: 'email' });
    return { userId: raced, created: false };
  }
}

export async function registerDoctor(
  deps: RegisterDoctorSagaDeps,
  command: RegisterDoctorRequest,
): Promise<RegisterDoctorResponse> {
  const { userId, created } = await ensureUser(deps.directory, command);

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
    if (created) {
      await deps.directory.deleteUser(userId);
    }
    throw error;
  }
}

/** Команда «создать учётную запись для существующего врача» (ADMIN, 3.2+). */
export interface CreateDoctorAccountCommand extends CreateDoctorAccountRequest {
  doctorId: string;
}

/**
 * Учётная запись для УЖЕ существующего карточки врача — правило «учётная
 * запись создаётся администратором всегда»:
 *
 *   A. та же, что в саге 9.1 (идемпотентность по email, гонка submit);
 *   B. привязка userId к карточке (вместо создания новой);
 *   компенсация: при сбое B созданный ЭТОЙ сагой пользователь удаляется.
 *
 * Email уже привязан к другому врачу → 409 (поле email); повтор с той же
 * связкой — no-op (повторная отправка формы).
 */
export async function createDoctorAccount(
  deps: RegisterDoctorSagaDeps,
  command: CreateDoctorAccountCommand,
): Promise<{ userId: string }> {
  const { userId, created } = await ensureUser(deps.directory, command);

  const bound = await deps.catalog.findDoctorByUser(userId);
  if (bound) {
    if (bound.id === command.doctorId) return { userId }; // идемпотентный повтор
    throw new ConflictError('Email уже привязан к другому врачу', { field: 'email' });
  }

  try {
    await deps.catalog.linkDoctorUser(command.doctorId, userId);
  } catch (error) {
    if (created) {
      await deps.directory.deleteUser(userId);
    }
    throw error;
  }

  return { userId };
}
