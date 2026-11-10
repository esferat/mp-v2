/**
 * Домен read-model расписаний (5.1): копия карточки врача из событий
 * doctor.created/updated.v1 — слоты считаются БЕЗ похода в catalog (AC 5.1).
 */

export type CopyStatus = 'ACTIVE' | 'INACTIVE';

export interface DoctorScheduleCopy {
  readonly doctorId: string;
  /** Keycloak sub врача (9.1/9.2): привязка sub → doctorId без HTTP. */
  readonly userId?: string | null;
  readonly specializationId: string;
  readonly specializationName: string;
  readonly lastName: string;
  readonly firstName: string;
  readonly middleName?: string;
  readonly status: CopyStatus;
  /** HH:mm. */
  readonly startTime: string;
  readonly endTime: string;
  readonly durationMinutes: number;
  /** 1 = понедельник … 7 = воскресенье. */
  readonly workDays: number[];
  /** occurredAt события-источника (ISO): идемпотентность применений. */
  readonly sourceAt: string;
}

/** Данные события doctor.*.v1 для применения к копии (payload уже проверен Zod). */
export interface DoctorEventData {
  doctorId: string;
  /** Keycloak sub врача (9.1). */
  userId?: string | null;
  specializationId: string;
  specializationName: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  status: CopyStatus;
  schedule: {
    startTime: string;
    endTime: string;
    durationMinutes: number;
    workDays: number[];
  };
  /** occurredAt конверта события. */
  occurredAt: string;
}

export interface ScheduleCopyRepository {
  /**
   * Идемпотентный апсерт (5.1 AC): событие применяется, только если его
   * occurredAt не раньше sourceAt копии — повтор и гонка порядка не
   * откатывают более свежие данные.
   */
  applyDoctorEvent(data: DoctorEventData): Promise<{ applied: boolean }>;

  /** Все копии специализации (фильтр ACTIVE — на стороне use-case). */
  findForSpecialization(specializationId: string): Promise<DoctorScheduleCopy[]>;

  /** Копия врача (проверка перед бронью, 5.3); null — не найдена. */
  findById(doctorId: string): Promise<DoctorScheduleCopy | null>;

  /** Копия по Keycloak sub (9.2: свои записи врача); null — привязки нет. */
  findByUserId(userId: string): Promise<DoctorScheduleCopy | null>;

  /** Число копий (bootstrap: 0 → импорт из catalog, 5.1). */
  count(): Promise<number>;
}

/** DI-токен привязки реализации (сборка — в app/app.module.ts). */
export const SCHEDULE_COPY_REPOSITORY = Symbol('SchedulingScheduleCopyRepository');

/** Копия пригодна для расчёта слотов и брони: врач активен (5.1/5.3). */
export function isActiveCopy(
  copy: DoctorScheduleCopy | null | undefined,
): copy is DoctorScheduleCopy {
  return copy !== null && copy !== undefined && copy.status === 'ACTIVE';
}
