/**
 * Расчёт свободных слотов (5.2): чистая функция без БД и сети —
 * окна врачей из копий расписания минус занятые окна записей.
 */

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** HH:mm в минуты от полуночи; null — формат нарушен. */
export function toMinutes(hhmm: string): number | null {
  const match = HHMM.exec(hhmm);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Минуты в HH:mm. */
export function formatMinutes(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** ISO-дата (YYYY-MM-DD) → номер дня недели 1 = понедельник … 7 = воскресенье. */
export function isoDayOfWeek(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return 0;
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = вс
  return ((utcDay + 6) % 7) + 1;
}

/** Окно врача из копии расписания (5.2). */
export interface SlotWindow {
  doctorId: string;
  /** ФИО врача для карточек wizard'а (без похода в каталог). */
  doctorName: string;
  /** HH:mm начала рабочего дня. */
  startTime: string;
  endTime: string;
  durationMinutes: number;
  /** 1 = понедельник … 7 = воскресенье. */
  workDays: number[];
}

export interface Slot {
  localDate: string;
  start: string;
  end: string;
  doctorId: string;
  doctorName: string;
}

/** Ключ занятого слота: `${doctorId}|${localDate}|${start}`. */
export function busyKey(doctorId: string, localDate: string, start: string): string {
  return `${doctorId}|${localDate}|${start}`;
}

/**
 * Нарушение правила бронирования: поле + сообщение (5.3: ответ 400
 * с конкретным полем, не 500).
 */
export interface SlotIssue {
  field: string;
  message: string;
}

/**
 * Проверка слота перед бронью (5.3): дата не в прошлом, рабочий день,
 * время внутри окна врача и кратно длительности. Чистая функция —
 * use-case book-appointment только превращает SlotIssue в ValidationError.
 *
 * @param window окно врача из копии расписания (5.1)
 * @param slot запрошенный слот (localDate YYYY-MM-DD, start HH:mm)
 * @param nowUtc «сейчас» (подменяется в тестах)
 * @returns null — слот валиден; иначе поле + сообщение
 */
export function validateSlotWindow(
  window: { startTime: string; endTime: string; durationMinutes: number; workDays: number[] },
  slot: { localDate: string; start: string },
  nowUtc: Date,
): SlotIssue | null {
  const startMin = toMinutes(slot.start);
  const windowStart = toMinutes(window.startTime);
  const windowEnd = toMinutes(window.endTime);
  if (startMin === null) return { field: 'slot.start', message: 'Некорректное время слота' };
  if (windowStart === null || windowEnd === null) {
    return { field: 'doctorId', message: 'Некорректное расписание врача' };
  }

  const today = nowUtc.toISOString().slice(0, 10);
  if (slot.localDate < today) {
    return { field: 'slot.localDate', message: 'Дата приёма в прошлом' };
  }
  if (slot.localDate === today && startMin < nowUtc.getHours() * 60 + nowUtc.getMinutes()) {
    return { field: 'slot.start', message: 'Этот слот уже прошёл' };
  }
  if (!window.workDays.includes(isoDayOfWeek(slot.localDate))) {
    return { field: 'slot.localDate', message: 'Врач не работает в этот день' };
  }
  const duration = window.durationMinutes;
  if (
    startMin < windowStart ||
    startMin + duration > windowEnd ||
    (startMin - windowStart) % duration !== 0
  ) {
    return { field: 'slot.start', message: 'Время вне рабочего окна врача' };
  }
  return null;
}

/**
 * Свободные слоты (5.2): сетка start..end с шагом durationMinutes по
 * рабочим дням каждого врача, минус занятые (busy). Фильтры startTime/endTime
 * (query) сужают окно, не меняя шаг.
 *
 * Ожидаемый диапазон дат ограничен вызывающим (use-case кладёт предел —
 * защита от чрезмерного расчёта).
 */
export function computeSlots(args: {
  windows: readonly SlotWindow[];
  from: string;
  to: string;
  busy: ReadonlySet<string>;
  startTime?: string;
  endTime?: string;
}): Slot[] {
  const slots: Slot[] = [];

  for (const window of args.windows) {
    const windowStart = toMinutes(window.startTime);
    const windowEnd = toMinutes(window.endTime);
    const queryStart = args.startTime ? toMinutes(args.startTime) : null;
    const queryEnd = args.endTime ? toMinutes(args.endTime) : null;
    if (windowStart === null || windowEnd === null) continue;
    if (args.startTime && queryStart === null) continue;
    if (args.endTime && queryEnd === null) continue;

    const dayStart = Math.max(windowStart, queryStart ?? 0);
    const dayEnd = Math.min(windowEnd, queryEnd ?? 24 * 60);
    const duration = window.durationMinutes;
    if (dayEnd - dayStart < duration) continue;

    for (const localDate of iterateDates(args.from, args.to)) {
      if (!window.workDays.includes(isoDayOfWeek(localDate))) continue;

      for (let start = dayStart; start + duration <= dayEnd; start += duration) {
        const startLabel = formatMinutes(start);
        if (args.busy.has(busyKey(window.doctorId, localDate, startLabel))) continue;
        slots.push({
          localDate,
          start: startLabel,
          end: formatMinutes(start + duration),
          doctorId: window.doctorId,
          doctorName: window.doctorName,
        });
      }
    }
  }

  // Стабильный порядок: дата → время → врач (детерминированный ответ)
  slots.sort(
    (a, b) =>
      a.localDate.localeCompare(b.localDate) ||
      a.start.localeCompare(b.start) ||
      a.doctorId.localeCompare(b.doctorId),
  );
  return slots;
}

/** Перебор дат [from, to] включительно (один день = шаг календаря, без DST-сдвигов). */
export function* iterateDates(from: string, to: string): Generator<string> {
  const [y, m, d] = from.split('-').map(Number);
  if (!y || !m || !d) return;
  const cursor = new Date(Date.UTC(y, m - 1, d));
  const [ty, tm, td] = to.split('-').map(Number);
  const end = ty && tm && td ? Date.UTC(ty, tm - 1, td) : cursor.getTime();

  while (cursor.getTime() <= end) {
    yield cursor.toISOString().slice(0, 10);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}
