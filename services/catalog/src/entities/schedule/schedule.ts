/**
 * Доменные правила расписания врача (3.2): чистые проверки, не выраженные
 * в Zod-схеме контракта. doctorScheduleSchema (Zod) гарантирует формат HH:mm,
 * длительность 5—240 и непустой список дней; здесь — инварианты
 * предметной области. Единственная точка истины для ответа 400 с полем (AC 3.2).
 */

/**
 * Форма расписания для проверок: структурное подмножество расписания врача
 * (4 поля) без кросс-импорта сущности doctor (граница FSD).
 */
export interface ScheduleWindow {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  workDays: number[];
}

/** Нарушение правила расписания: поле формы + сообщение. */
export interface ScheduleIssue {
  /** Путь к полю: schedule.startTime | schedule.endTime | schedule.durationMinutes | schedule.workDays. */
  field: string;
  message: string;
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** HH:mm в минуты от полуночи; null — формат нарушен. */
export function toMinutes(hhmm: string): number | null {
  const match = HHMM.exec(hhmm);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Проверки расписания (3.2):
 * - начало строго раньше конца;
 * - период кратен длительности приёма (иначе последнее окно дня
 *   не закрывается границей рабочего времени);
 * - null — расписание валидно.
 */
export function validateSchedule(schedule: ScheduleWindow): ScheduleIssue | null {
  const start = toMinutes(schedule.startTime);
  const end = toMinutes(schedule.endTime);

  if (start === null || end === null) {
    return { field: 'schedule.startTime', message: 'Время в формате HH:mm' };
  }
  if (start >= end) {
    return {
      field: 'schedule.startTime',
      message: 'Начало рабочего дня должно быть раньше конца',
    };
  }
  if (schedule.durationMinutes < 5 || schedule.durationMinutes > 240) {
    return {
      field: 'schedule.durationMinutes',
      message: 'Длительность приёма от 5 до 240 минут',
    };
  }
  // NB: требование «период кратен длительности» снято: сетка слотов
  // (entities/scheduling) не предлагает неполные окна, а правило запрещало
  // рабочие длительности вроде 7/40/55 мин при периоде 09:00–18:00.
  if (schedule.workDays.length === 0) {
    return { field: 'schedule.workDays', message: 'Выберите хотя бы один рабочий день' };
  }
  return null;
}
