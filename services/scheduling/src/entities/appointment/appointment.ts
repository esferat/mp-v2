import type { AppointmentStatus } from '@mp/contracts';
import type { OutboxWriter } from '../../shared/model';

/**
 * Домен записи на приём (5.3/5.4): снапшоты ФИО и расписания — история
 * не переписывается справочниками (AC 3.2), статусы — по канонической
 * таблице (functional-spec §1 «Статусная машина записи»).
 */

export interface Appointment {
  readonly id: string;
  readonly doctorId: string;
  /** Снапшот ФИО врача на момент записи. */
  readonly doctorName: string;
  readonly specializationId: string;
  readonly specializationName: string;
  readonly patientId: string;
  /** Снапшот ФИО пациента на момент записи. */
  readonly patientName: string;
  /** HH:mm начала/конца окна. */
  readonly startTime: string;
  readonly endTime: string;
  /** ISO-дата (YYYY-MM-DD). */
  readonly localDate: string;
  readonly status: AppointmentStatus;
  readonly declineReason?: string;
  readonly createdAt: string;
  /** Результат приёма для COMPLETED (9.2): подтягивается списками. */
  readonly visitResult?: {
    conclusion: string;
    recommendations?: string;
  };
}

export interface CreateAppointmentData {
  doctorId: string;
  doctorName: string;
  specializationId: string;
  specializationName: string;
  patientId: string;
  patientName: string;
  startTime: string;
  endTime: string;
  localDate: string;
}

/** Данные переноса (10.3): обновление записи + строка журнала одной транзакцией. */
export interface RescheduleData {
  id: string;
  doctorId: string;
  doctorName: string;
  specializationId: string;
  specializationName: string;
  /** HH:mm нового окна (конец уже вычислен по длительности врача). */
  startTime: string;
  endTime: string;
  /** YYYY-MM-DD. */
  localDate: string;
  log: {
    /** Статус ДО переноса (перенос статус не меняет). */
    previousStatus: AppointmentStatus;
    /** Снимок слота/врача до переноса (журнал, 10.3). */
    old: { doctorId: string; localDate: string; start: string; end: string };
    /** Кто инициировал (sub из токена — только ADMIN). */
    changedBy: string;
    reason?: string;
  };
}

export interface AppointmentPageQuery {
  offset: number;
  limit: number;
  status?: AppointmentStatus;
  specId?: string;
  /** Мультивыбор специализаций (админ-фильтр): IN по списку id. */
  specIds?: readonly string[];
  doctorId?: string;
  /** Мультивыбор врачей (админ-фильтр): IN по списку id. */
  doctorIds?: readonly string[];
  patientId?: string;
  /** ISO-даты включительно. */
  from?: string;
  to?: string;
}

/**
 * Канонические переходы (functional-spec §1): любому иному переходу — 409.
 * Повторная команда (двойной клик) также даёт 409 без побочных эффектов
 * (5.4 AC: «200 с состоянием ИЛИ 409 — зафиксировано»: выбран 409).
 */
const TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  SUBMITTED: ['APPROVED', 'DECLINED', 'CANCELLED'],
  APPROVED: ['CANCELLED', 'COMPLETED'],
  // терминальные состояния
  DECLINED: [],
  CANCELLED: [],
  COMPLETED: [],
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

/** Порт записей (реализация — shared/api, тесты — in-memory). */
export interface AppointmentRepository {
  /**
   * Создание записи: частичный уникальный индекс (doctorId, localDate, start)
   * WHERE status <> 'CANCELLED' → при дубле ConflictError { code: 'SLOT_TAKEN' }
   * (5.3 AC: два запроса → один 201, второй 409).
   */
  create(data: CreateAppointmentData): Promise<Appointment>;

  findById(id: string): Promise<Appointment | null>;

  /** Обновление статуса/причины; null — запись исчезла (гонка удаления). */
  updateStatus(
    id: string,
    status: AppointmentStatus,
    declineReason?: string | null,
  ): Promise<Appointment | null>;

  /**
   * Перенос (10.3): обновляет слот/врача ТОЛЬКО из SUBMITTED/APPROVED —
   * гонка статуса (запись уже обработана) → null; дубль слота гасится
   * частичным уникальным индексом → SlotTakenError (409); строка журнала
   * пишется в той же транзакции, что и обновление.
   */
  reschedule(data: RescheduleData): Promise<Appointment | null>;

  findPage(query: AppointmentPageQuery): Promise<{ items: Appointment[]; total: number }>;

  /**
   * Занятые слоты врачей за период (status <> CANCELLED) — для расчёта
   * свободных окон (5.2). Ключ строки: doctorId | localDate | startTime.
   */
  findBusy(
    doctorIds: readonly string[],
    from: string,
    to: string,
  ): Promise<Array<{ doctorId: string; localDate: string; startTime: string }>>;

  /**
   * Денализация ФИО пациента в записи (4.6): списки/история отражают
   * ТЕКУЩЕЕ имя пациента (правило фиксируется в слайсе patient-sync);
   * снапшот врача/специализации при этом не меняется.
   * Возвращает число обновлённых записей.
   */
  updatePatientName(patientId: string, patientName: string): Promise<number>;

  /**
   * Пациенты врача (9.3): distinct из его записей, новые сверху.
   * lastVisit — последний приём в формате YYYY-MM-DD.
   */
  findDistinctPatients(
    doctorId: string,
  ): Promise<Array<{ patientId: string; patientName: string; lastVisit?: string }>>;

  /**
   * Связь «врач-пациент» (9.3): есть ли у врача действующая запись
   * с пациентом (APPROVED или COMPLETED). Отменённая/отклонённая запись
   * связи не даёт — доступ к документам закрывается (AC 9.3).
   */
  hasRelation(doctorId: string, patientId: string): Promise<boolean>;
}

/** DI-токен привязки реализации (сборка — в app/app.module.ts). */
export const APPOINTMENT_REPOSITORY = Symbol('SchedulingAppointmentRepository');

/**
 * Контекст транзакции записи: строка + событие appointment.* атомарны (0.9).
 * Результат приёма НЕ входит в контекст (граница FSD: кросс-импортов между
 * entities нет) — его порт слайса visit-result передаётся в use-case
 * отдельным аргументом, транзакция общая (UnitOfWork).
 */
export interface AppointmentContext {
  appointments: AppointmentRepository;
  outbox: OutboxWriter;
}
