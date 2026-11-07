/**
 * Домен карточки пациента (1.4: шаг B саги регистрации).
 * Чистые типы и правила — без Prisma/HTTP (fsd.md §4.4).
 */

export interface Patient {
  readonly id: string;
  /** Keycloak `sub`. */
  readonly userId: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly middleName?: string;
  /** ISO-дата (YYYY-MM-DD). */
  readonly birthDate: string;
  registeredAt: string;
}

/** Порт доступа к карточкам (hexagonal: реализация — shared/api, тесты — in-memory). */
export interface PatientRepository {
  /** Поиск по Keycloak `sub`; null — карточки ещё нет. */
  findByUserId(userId: string): Promise<Patient | null>;
  /**
   * Идемпотентное создание: если карточка с userId/email уже есть —
   * возвращается существующая (двойной submit → одна карточка, 1.4 AC).
   */
  createIfAbsent(data: Omit<Patient, 'id' | 'registeredAt'>): Promise<Patient>;
}

/** DI-токен привязки реализации (сборка — в app/app.module.ts). */
export const PATIENT_REPOSITORY = Symbol('PatientPatientRepository');
