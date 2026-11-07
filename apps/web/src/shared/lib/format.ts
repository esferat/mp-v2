/** Форматирование дат/времени записей (5.4/5.5): единый вид в списках. */

/** ISO-дата (YYYY-MM-DD) → dd.MM.yyyy. */
export function formatRuDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}.${month}.${year}`;
}

/** Запись: «05.11.2026 10:00». */
export function formatSlot(isoDate: string, start: string): string {
  return `${formatRuDate(isoDate)} ${start}`;
}

/** Название специализации для select'а истории/записи. */
export function specializationOptions(
  items: ReadonlyArray<{ id: string; name: string }>,
): Array<{ value: string; label: string }> {
  return items.map((item) => ({ value: item.id, label: item.name }));
}
