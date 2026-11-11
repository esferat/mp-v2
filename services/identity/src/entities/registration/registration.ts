/**
 * Домен саги регистрации (1.4): два порта, которые сага оркестрирует.
 * Ядро не знает про HTTP/Keycloak — только интерфейсы (hexagonal, fsd.md §4.4).
 */

/** Новый пользователь Keycloak (шаг A). */
export interface NewUser {
  email: string;
  /** Пароль не покидает этот вызов — в логи и сущности не попадает (1.4 AC). */
  password: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  /** Дата рождения для атрибутов пользователя (карточка пациента, 1.4). */
  birthDate?: string;
  /**
   * Realm-роль: USER (пациент, 1.4) или DOCTOR (врач, 9.1).
   * По умолчанию USER — прежнее поведение не меняется.
   */
  realmRole?: 'USER' | 'DOCTOR';
}

/** Порт каталога пользователей (реализация — shared/api/keycloak-admin.client). */
export interface UserDirectory {
  /** Поиск по email (exact): userId или null. */
  findByEmail(email: string): Promise<string | null>;

  /** Создание пользователя с ролью (по умолчанию USER). Email занят → EmailExistsError. */
  createUser(user: NewUser): Promise<string>;

  /** Компенсация: best-effort удаление (ретраи делает адаптер). */
  deleteUser(userId: string): Promise<void>;

  /** Профиль пользователя (10.1): email/ФИО из Keycloak; null — нет. */
  findProfile(userId: string): Promise<UserProfileData | null>;

  /**
   * Правка СВОИХ данных (10.1): только переданные поля; логин следует за
   * email (username = email, как при регистрации). Email занят → EmailExistsError.
   */
  updateProfile(
    userId: string,
    patch: { email?: string; firstName?: string; lastName?: string },
  ): Promise<UserProfileData>;
}

/** Профиль пользователя Keycloak (10.1): email + ФИО. */
export interface UserProfileData {
  email: string;
  firstName: string;
  lastName: string;
}

/** Email уже зарегистрирован (маппится в 409, человекочитаемый ответ). */
export class EmailExistsError extends Error {
  constructor(email: string) {
    super(`Пользователь с email ${email} уже зарегистрирован`);
    this.name = 'EmailExistsError';
  }
}

/** Порт карточек пациентов (patient-service, шаг B). */
export interface PatientCards {
  /** Карточка по userId; null — ещё нет. */
  findByUserId(userId: string): Promise<{ id: string } | null>;

  /** Идемпотентное создание карточки (уникальность — на стороне patient). */
  create(card: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    birthDate: string;
  }): Promise<{ id: string }>;
}

/** patient-service недоступен/упал — сага компенсирует и отдаёт 500. */
export class PatientServiceError extends Error {
  constructor(detail: string) {
    super(`patient-service недоступен: ${detail}`);
    this.name = 'PatientServiceError';
  }
}

/** DI-токены привязки реализаций (сборка — в app/app.module.ts). */
export const USER_DIRECTORY = Symbol('IdentityUserDirectory');
export const PATIENT_CARDS = Symbol('IdentityPatientCards');
export const CATALOG_DOCTORS = Symbol('IdentityCatalogDoctors');

/** Порт catalog-service: создание врача с userId (сага 9.1, шаг B). */
export interface CatalogDoctors {
  /** Возвращает карточку созданного врача (нужен id для ответа саги). */
  createDoctor(data: {
    userId: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    specializationId: string;
    schedule: {
      startTime: string;
      endTime: string;
      durationMinutes: number;
      workDays: number[];
    };
  }): Promise<{ id: string }>;

  /** Существующий врач по userId (9.1: идемпотентный повтор саги); null — нет. */
  findDoctorByUser(userId: string): Promise<{ id: string } | null>;

  /**
   * Привязка userId к УЖЕ существующему карточке врача (правило «учётная
   * запись создаётся администратором всегда»);404 — карточки нет,
   * 409 — привязка занята.
   */
  linkDoctorUser(doctorId: string, userId: string): Promise<void>;
}
