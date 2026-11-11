/**
 * Валидация формы врача (3.2): клиентское зеркало серверных правил
 * (entities/schedule в catalog) для мгновенной обратной связи.
 *
 * Поля/валидация/превью РАСПИСАНИЯ живут в `shared/lib/schedule` (DRY:
 * ими же пользуется self-service форма 10.4) и реэкспортируются отсюда —
 * публичный API слайса не меняется.
 *
 * ИСТИНА — сервер: при расхождении побеждает ответ 400 с полем,
 * сюда ошибки подмешиваются поверх клиентских (см. doctor-form.tsx).
 */

import { type ScheduleErrors, validateScheduleFields } from '@/shared/lib';

// Реэкспорт общих хелперов расписания (обратная совместимость API слайса)
export {
  DAY_LABELS,
  DURATION_OPTIONS,
  formatMinutes,
  schedulePreview,
  toMinutes,
} from '@/shared/lib';

export interface DoctorFormValues {
  firstName: string;
  lastName: string;
  middleName: string;
  specializationId: string;
  /** HH:mm. */
  startTime: string;
  /** HH:mm. */
  endTime: string;
  durationMinutes: number;
  /** 1 = Пн … 7 = Вс. */
  workDays: number[];
  /**
   * Email и пароль учётной записи (9.1): create — создаётся всегда
   * (правило «учётную запись создаёт админ всегда»); edit — смена email
   * существующей учётки или создание новой у врача без неё.
   */
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

export interface ValidateDoctorFormOptions {
  /**
   * Email обязателен и проверяется: create — всегда; edit с учётной
   * записью — всегда; edit без учётной записи — при заполнении (создание).
   */
  emailRequired?: boolean;
  /**
   * Пароль обязателен: create — всегда (правило «всегда»); edit — только
   * когда создаётся учётная запись существующему врачу.
   */
  passwordRequired?: boolean;
}

/** Клиентская валидация: пустые значения + правила расписания (зеркало сервера). */
export function validateDoctorForm(
  values: DoctorFormValues,
  options: ValidateDoctorFormOptions = {},
): DoctorFormErrors {
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

  // Учётная запись: обязательна (create/edit-с-учёткой) или заполнена
  // добровольно (edit без учётки — создание и привязка)
  if (options.emailRequired || values.email.trim()) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      errors.email = 'Некорректный email';
    }
  }
  if (options.passwordRequired || values.password) {
    if (values.password.length < 8) {
      errors.password = 'Пароль: минимум 8 символов';
    }
  }

  // Правила расписания — общий слайс (shared/lib/schedule)
  const scheduleErrors: ScheduleErrors = validateScheduleFields(values);
  for (const [field, message] of Object.entries(scheduleErrors)) {
    errors[field as DoctorFormField] = message;
  }

  return errors;
}
