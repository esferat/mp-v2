/**
 * Валидация формы врача (3.2): клиентское зеркало серверных правил
 * (entities/schedule в catalog) для мгновенной обратной связи.
 *
 * ИСТИНА — сервер: при расхождении побеждает ответ 400 с полем,
 * сюда ошибки подмешиваются поверх клиентских (см. doctor-form.tsx).
 */

export interface DoctorFormValues {
  firstName: string;
  lastName: string;
  middleName: string;
  specializationId: string;
  /** HH:mm. */
  startTime: string;
  endTime: string;
  durationMinutes: number;
  /** 1 = Пн … 7 = Вс. */
  workDays: number[];
  /** 9.1: создать учётную запись врача в Keycloak. */
  createAccount: boolean;
  email: string;
  password: string;
}

export type DoctorFormField =
  | 'firstName'
  | 'lastName'
  | 'specializationId'
  | 'schedule.startTime'
  | 'schedule.endTime'
  | 'schedule.durationMinutes'
  | 'schedule.workDays'
  | 'email'
  | 'password';

export type DoctorFormErrors = Partial<Record<DoctorFormField, string>>;

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

/** Является ли ключ ошибкой поля формы (field из ApiError может быть любым). */
export function isFormField(key: string): key is DoctorFormField {
  return (
    key === 'firstName' ||
    key === 'lastName' ||
    key === 'specializationId' ||
    key === 'schedule.startTime' ||
    key === 'schedule.endTime' ||
    key === 'schedule.durationMinutes' ||
    key === 'schedule.workDays' ||
    key === 'email' ||
    key === 'password'
  );
}

/** Клиентская валидация: пустые значения + правила расписания (зеркало сервера). */
export function validateDoctorForm(values: DoctorFormValues): DoctorFormErrors {
  const errors: DoctorFormErrors = {};

  if (!values.firstName.trim()) {
    errors.firstName = 'Укажите имя';
  } else if (values.firstName.trim().length > 100) {
    errors.firstName = 'Имя: не длиннее 100 символов';
  }

  if (!values.lastName.trim()) {
    errors.lastName = 'Укажите фамилию';
  } else if (values.lastName.trim().length > 100) {
    errors.lastName = 'Фамилия: не длиннее 100 символов';
  }

  if (!values.specializationId) {
    errors.specializationId = 'Выберите специализацию';
  }

  // 9.1: поля учётной записи обязательны только при включённом чекбоксе
  if (values.createAccount) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      errors.email = 'Некорректный email';
    }
    if (values.password.length < 8) {
      errors.password = 'Пароль: минимум 8 символов';
    }
  }

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

/** Превью слотов (3.2, макет): null, пока расписание невалидно. */
export function schedulePreview(
  values: DoctorFormValues,
): { times: string[]; perDay: number } | null {
  if (Object.keys(validateDoctorForm(values)).some((key) => key.startsWith('schedule'))) {
    return null;
  }
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
