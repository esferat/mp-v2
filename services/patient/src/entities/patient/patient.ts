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
  /** Ключ фото в MinIO (4.3): внутренний, в API не отдаётся. */
  readonly photoKey?: string;
  registeredAt: string;
}

/** Порт доступа к карточкам (hexagonal: реализация — shared/api, тесты — in-memory). */
export interface PatientRepository {
  /** Поиск по Keycloak `sub`; null — карточки ещё нет. */
  findByUserId(userId: string): Promise<Patient | null>;

  /** Поиск по id карточки; null — не найдена. */
  findById(id: string): Promise<Patient | null>;

  /** Установка/очистка ключа фото (key = null); null — карточки нет. */
  setPhoto(id: string, key: string | null): Promise<Patient | null>;

  /**
   * Идемпотентное создание: если карточка с userId/email уже есть —
   * возвращается существующая (двойной submit → одна карточка, 1.4 AC).
   */
  createIfAbsent(data: Omit<Patient, 'id' | 'registeredAt'>): Promise<Patient>;

  /**
   * Обновление данных (4.2): email/ФИО/дата рождения; занятый email →
   * ConflictError. userId не меняется (привязка к Keycloak фиксирована).
   */
  update(
    id: string,
    data: {
      email: string;
      firstName: string;
      lastName: string;
      middleName?: string;
      birthDate: string;
    },
  ): Promise<Patient>;

  /** Страница списка для админки (4.1): поиск по ФИО/email, offset/limit. */
  findPage(query: {
    offset: number;
    limit: number;
    /** Подстрока поиска без учёта регистра. */
    search?: string;
  }): Promise<{ items: Patient[]; total: number }>;
}

/** DI-токен привязки реализации (сборка — в app/app.module.ts). */
export const PATIENT_REPOSITORY = Symbol('PatientPatientRepository');

/**
 * Публичный вид карточки (4.2/DRY): внутренний photoKey не покидает сервис
 * (вместо него API отдаёт presigned photoUrl там, где он нужен).
 */
export function toPublicPatient(patient: Patient): Omit<Patient, 'photoKey'> {
  return {
    id: patient.id,
    userId: patient.userId,
    email: patient.email,
    firstName: patient.firstName,
    lastName: patient.lastName,
    ...(patient.middleName ? { middleName: patient.middleName } : {}),
    birthDate: patient.birthDate,
    registeredAt: patient.registeredAt,
  };
}
