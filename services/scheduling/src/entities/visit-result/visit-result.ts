import { ValidationError } from '../../shared/model';

/**
 * Домен результата приёма (9.2): заключение обязательно (≤ 4000),
 * рекомендации опциональны (≤ 4000). Валидация живёт ЗДЕСЬ, а не в
 * controller (чек-лист 9.2).
 */

export interface VisitResult {
  readonly id: string;
  readonly appointmentId: string;
  readonly conclusion: string;
  readonly recommendations?: string;
  /** userId врача, внёсшего результат. */
  readonly createdBy: string;
  readonly updatedAt: string;
}

export interface CreateVisitResultData {
  appointmentId: string;
  conclusion: string;
  recommendations?: string;
  createdBy: string;
}

export const CONCLUSION_MAX = 4000;
export const RECOMMENDATIONS_MAX = 4000;

/**
 * Валидация данных результата (9.2): trim, обязательность и лимиты.
 * Бросает ValidationError → 400 с конкретным полем.
 */
export function validateVisitResult(input: { conclusion: string; recommendations?: string }): {
  conclusion: string;
  recommendations?: string;
} {
  const conclusion = input.conclusion.trim();
  if (!conclusion) {
    throw new ValidationError('Заключение обязательно', 'conclusion');
  }
  if (conclusion.length > CONCLUSION_MAX) {
    throw new ValidationError(`Заключение не длиннее ${CONCLUSION_MAX} символов`, 'conclusion');
  }

  const recommendations = input.recommendations?.trim();
  if (recommendations && recommendations.length > RECOMMENDATIONS_MAX) {
    throw new ValidationError(
      `Рекомендации не длиннее ${RECOMMENDATIONS_MAX} символов`,
      'recommendations',
    );
  }

  return {
    conclusion,
    ...(recommendations ? { recommendations } : {}),
  };
}

/** Порт результатов (реализация — shared/api, тесты — in-memory). */
export interface VisitResultRepository {
  /** Результат записи; null — ещё не внесён. */
  findByAppointmentId(appointmentId: string): Promise<VisitResult | null>;

  /** Создание; дубль по appointmentId (unique) → ConflictError. */
  create(data: CreateVisitResultData): Promise<VisitResult>;

  /** Правка текста уже существующего результата. */
  update(
    appointmentId: string,
    data: { conclusion: string; recommendations?: string },
  ): Promise<VisitResult | null>;
}

/** DI-токен привязки реализации (сборка — в app/app.module.ts). */
export const VISIT_RESULT_REPOSITORY = Symbol('SchedulingVisitResultRepository');

/**
 * Контекст транзакции результата приёма (9.2): строка результата и статус
 * записи пишутся ОДНОЙ транзакцией — контекст является пересечением
 * AppointmentContext & VisitResultContext (сборка в shared/api/prisma.unit-of-work).
 * Кросс-импортов между entities нет: каждый слой владеет только своим портом.
 */
export interface VisitResultContext {
  visitResults: VisitResultRepository;
}
