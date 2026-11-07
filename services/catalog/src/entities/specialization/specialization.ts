import { ValidationError } from '../../shared/model';

/**
 * Домен специализации (справочник врачей).
 * Чистые правила без зависимостей от Prisma/HTTP (fsd.md §4.4).
 */

export interface Specialization {
  readonly id: string;
  /** Название, как оно хранится (без лишних пробелов). */
  readonly name: string;
  /** Число врачей специализации (для списка и проверки удаления). */
  readonly doctorsCount: number;
}

export const SPECIALIZATION_NAME_MIN = 2;
export const SPECIALIZATION_NAME_MAX = 120;

/**
 * Доменное правило 3.3: имя 2–120 символов после обрезки, пробелы схлопнуты.
 * Бросает ValidationError → 400 с указанием поля.
 */
export function normalizeSpecializationName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');

  if (name.length < SPECIALIZATION_NAME_MIN) {
    throw new ValidationError('Название специализации слишком короткое', 'name');
  }
  if (name.length > SPECIALIZATION_NAME_MAX) {
    throw new ValidationError('Название специализации слишком длинное', 'name');
  }
  return name;
}

/** Ключ регистронезависимого поиска/уникальности (хранится отдельной колонкой). */
export function specializationKey(name: string): string {
  return name.toLowerCase();
}
