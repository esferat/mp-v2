/**
 * Форматирование данных записи для писем (6.2, локальность ru).
 * Чистые функции — без зависимостей, покрываются unit-тестами.
 */

/** ISO-дата (YYYY-MM-DD) → DD.MM.YYYY. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}.${month}.${year}`;
}

/** Слот { localDate, start, end } → «10.11.2026 10:00–10:30». */
export function formatSlot(slot: { localDate: string; start: string; end: string }): string {
  return `${formatDate(slot.localDate)} ${slot.start}–${slot.end}`;
}

/** ФИО из карточки пациента (порядок: Фамилия Имя Отчество). */
export function formatPatientName(patient: {
  firstName: string;
  lastName: string;
  middleName?: string;
}): string {
  return [patient.lastName, patient.firstName, patient.middleName ?? '']
    .filter((part) => part.length > 0)
    .join(' ');
}
