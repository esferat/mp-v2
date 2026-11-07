/**
 * Домен врача (3.1): карточка списка без Prisma/HTTP (fsd.md §4.4).
 */

export type DoctorStatus = 'ACTIVE' | 'INACTIVE';

/** Расписание приёма (период дня + рабочие дни). */
export interface DoctorSchedule {
  /** HH:mm — начало рабочего дня. */
  startTime: string;
  endTime: string;
  durationMinutes: number;
  /** 1 = понедельник … 7 = воскресенье. */
  workDays: number[];
}

export interface DoctorListItem {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly middleName?: string;
  readonly specializationId: string;
  readonly specializationName: string;
  readonly status: DoctorStatus;
  /** presigned GET (TTL 5 мин) — подписывается при выдаче списка. */
  readonly photoUrl?: string;
  /** Внутренний ключ фото в MinIO — НЕ отдаётся в API (use-case заменяет на photoUrl). */
  readonly photoKey?: string;
  readonly schedule: DoctorSchedule;
}

/** Запрос страницы списка (3.1): поиск по ФИО + пагинация offset/limit. */
export interface DoctorListQuery {
  offset: number;
  limit: number;
  /** Подстрока ФИО (без учёта регистра). */
  search?: string;
  status?: DoctorStatus;
}

/** Порт списка врачей (реализация — shared/api, тесты — in-memory). */
export interface DoctorRepository {
  /** Страница списка + общее число (для пагинации, AC 3.1). */
  findPage(query: DoctorListQuery): Promise<{ items: DoctorListItem[]; total: number }>;
}

/** DI-токен привязки реализации (сборка — в app/app.module.ts). */
export const DOCTOR_REPOSITORY = Symbol('CatalogDoctorRepository');

/** Порт подписи фото (presigned GET, TTL 5 мин — 0.5/3.1). */
export interface PhotoUrlSigner {
  sign(photoKey: string): Promise<string>;
}

export const PHOTO_URL_SIGNER = Symbol('CatalogPhotoUrlSigner');
