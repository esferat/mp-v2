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
  /** Дата рождения для атрибутов пользователя. */
  birthDate: string;
}

/** Порт каталога пользователей (реализация — shared/api/keycloak-admin.client). */
export interface UserDirectory {
  /** Поиск по email (exact): userId или null. */
  findByEmail(email: string): Promise<string | null>;
  /** Создание пользователя с ролью USER. Email занят → EmailExistsError. */
  createUser(user: NewUser): Promise<string>;
  /** Компенсация: best-effort удаление (ретраи делает адаптер). */
  deleteUser(userId: string): Promise<void>;
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
