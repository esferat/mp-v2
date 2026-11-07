/** Периоды фильтра записей (5.4/9.2): from/to в ISO-даты локального дня. */

/**
 * Период → диапазон дат (YYYY-MM-DD): 'today' — сегодня,
 * 'week' — сегодня + 6 дней, 'all' — без ограничения.
 * Чистая функция: используется и серверной страницей (SSR-фильтр),
 * и клиентским виджетом (DRY).
 */
export function periodRange(period: string): { from?: string; to?: string } {
  const today = new Date();
  const iso = (date: Date): string => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
  };
  if (period === 'today') return { from: iso(today), to: iso(today) };
  if (period === 'week') {
    const end = new Date(today);
    end.setDate(end.getDate() + 6);
    return { from: iso(today), to: iso(end) };
  }
  return {};
}

/** Опции select'а периода (value хранится в URL). */
export const PERIOD_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'all', label: 'Весь период' },
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: 'Неделя' },
];
