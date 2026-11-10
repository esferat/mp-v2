/**
 * Хелперы расписания врача (3.2 админом / 10.4 self-service): поля,
 * клиентская валидация и превью слотов.
 *
 * Источник правил — контракт `doctorScheduleSchema`; зеркало серверной
 * `entities/schedule` (catalog): при расхождении побеждает 400 с полем.
 */

/** Поля расписания (HH:mm, минуты, рабочие дни 1 = Пн … 7 = Вс). */
export interface ScheduleValues {
  /** HH:mm. */
  startTime: string;
  /** HH:mm. */
  endTime: string;
  durationMinutes: number;
  /** 1 = Пн … 7 = Вс. */
  workDays: number[];
}

export type ScheduleField =
  'schedule.startTime' | 'schedule.endTime' | 'schedule.durationMinutes' | 'schedule.workDays';

export type ScheduleErrors = Partial<Record<ScheduleField, string>>;

/**
 * Допустимые длительности приёма (3.2): каждая делит час без остатка —
 * в часе n целых приёмов (60/5=12, 60/10=6, 60/15=4, 60/20=3, 60/30=2).
 * Источник правил — контракт doctorScheduleSchema (зеркало сервера).
 */
export const DURATION_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 5, label: '5 мин' },
  { value: 10, label: '10 мин' },
  { value: 15, label: '15 мин' },
  { value: 20, label: '20 мин' },
  { value: 30, label: '30 мин' },
];

/** Рабочие дни для чекбоксов (1 = Пн … 7 = Вс). */
export const DAY_LABELS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 7, label: 'Вс' },
];

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** HH:mm в минуты от полуночи; null — формат нарушен. */
export function toMinutes(hhmm: string): number | null {
  const match = HHMM.exec(hhmm);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Минуты в HH:mm (для превью слотов). */
export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Клиентская валидация расписания: зеркало серверных правил (400 с полем). */
export function validateScheduleFields(values: ScheduleValues): ScheduleErrors {
  const errors: ScheduleErrors = {};

  const start = toMinutes(values.startTime);
  const end = toMinutes(values.endTime);
  const duration = values.durationMinutes;

  if (start === null || end === null) {
    errors['schedule.startTime'] = 'Время в формате HH:mm';
  } else if (start >= end) {
    errors['schedule.startTime'] = 'Начало рабочего дня должно быть раньше конца';
  } else if (!DURATION_OPTIONS.some((option) => option.value === duration)) {
    errors['schedule.durationMinutes'] = 'Длительность: 5, 10, 15, 20 или 30 минут';
  } else if ((end - start) % duration !== 0) {
    errors['schedule.durationMinutes'] = 'Рабочий период должен быть кратен длительности приёма';
  }

  if (values.workDays.length === 0) {
    errors['schedule.workDays'] = 'Выберите хотя бы один рабочий день';
  }

  return errors;
}

/** Превью слотов (3.2/10.4, макет): null, пока расписание невалидно. */
export function schedulePreview(
  values: ScheduleValues,
): { times: string[]; perDay: number } | null {
  if (Object.keys(validateScheduleFields(values)).length > 0) return null;
  const start = toMinutes(values.startTime);
  const end = toMinutes(values.endTime);
  if (start === null || end === null) return null;

  const times: string[] = [];
  for (let minute = start; minute < end && times.length < 6; minute += values.durationMinutes) {
    times.push(formatMinutes(minute));
  }
  // полных окон в дне: неполное хвостовое окно не предлагается
  const perDay = Math.floor((end - start) / values.durationMinutes);
  return { times, perDay };
}
