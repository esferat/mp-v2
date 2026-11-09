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
  /** Keycloak sub учётной записи врача (9.1); null/нет — привязки нет. */
  readonly userId?: string | null;
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

/**
 * Запрос страницы списка (3.1): поиск по ФИО, фильтры специализации/статуса,
 * пагинация offset/limit.
 */
export interface DoctorListQuery {
  offset: number;
  limit: number;
  /** Подстрока ФИО (без учёта регистра). */
  search?: string;
  status?: DoctorStatus;
  /** Фильтр по специализации (макет design/doctors-list.md). */
  specId?: string;
}

/** Данные создания врача (3.2): DTO после Zod, до Prisma. */
export interface CreateDoctorData {
  /** Keycloak sub врача (9.1: заполняет сага identity). */
  userId?: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  specializationId: string;
  schedule: DoctorSchedule;
  /** По умолчанию ACTIVE (default колонки). */
  status?: DoctorStatus;
}

/** Данные редактирования врача (3.2); status отсутствует = не менять. */
export type UpdateDoctorData = CreateDoctorData;

/** Порт врачей (реализация — shared/api, тесты — in-memory). */
export interface DoctorRepository {
  /** Страница списка + общее число (для пагинации, AC 3.1). */
  findPage(query: DoctorListQuery): Promise<{ items: DoctorListItem[]; total: number }>;
  /** Карточка по id (форма редактирования, 3.2); null — не найден. */
  findById(id: string): Promise<DoctorListItem | null>;
  /** Карточка по Keycloak sub (9.1: идемпотентность саги); null — нет привязки. */
  findByUserId(userId: string): Promise<DoctorListItem | null>;
  /** Создание; существование специализации проверяет use-case (400, не FK-500). */
  create(data: CreateDoctorData): Promise<DoctorListItem>;
  /** Обновление по id; отсутствие — P2025, use-case проверяет заранее (404). */
  update(id: string, data: UpdateDoctorData): Promise<DoctorListItem>;
  /** Установка/очистка ключа фото (3.4); null — врача нет. */
  setPhoto(id: string, key: string | null): Promise<DoctorListItem | null>;
}

/** DI-токен привязки реализации (сборка — в app/app.module.ts). */
export const DOCTOR_REPOSITORY = Symbol('CatalogDoctorRepository');

/**
 * Снимок карточки для API (DRY для списка и карточки): внутренний ключ
 * photoKey не покидает сервис, вместо него presigned photoUrl (TTL 5 мин).
 */
export async function toPublicDoctor(
  item: DoctorListItem,
  signer?: PhotoUrlSigner,
): Promise<DoctorListItem> {
  const base: DoctorListItem = {
    id: item.id,
    ...(item.userId !== undefined ? { userId: item.userId } : {}),
    firstName: item.firstName,
    lastName: item.lastName,
    ...(item.middleName ? { middleName: item.middleName } : {}),
    specializationId: item.specializationId,
    specializationName: item.specializationName,
    status: item.status,
    schedule: item.schedule,
  };

  if (item.photoKey && signer) {
    return { ...base, photoUrl: await signer.sign(item.photoKey) };
  }
  return base;
}

/** Порт подписи фото (presigned GET, TTL 5 мин — 0.5/3.1). */
export interface PhotoUrlSigner {
  sign(photoKey: string): Promise<string>;
}

export const PHOTO_URL_SIGNER = Symbol('CatalogPhotoUrlSigner');
