/**
 * Доменные ошибки сервиса. Единая классификация для фильтра исключений
 * (app/kernel) → формат ответа ApiError из @mp/contracts.
 */
export abstract class DomainError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Ошибка валидации входных данных → 400, с указанием поля. */
export class ValidationError extends DomainError {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

/** Сущность не найдена → 404. */
export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
  }
}

/** Конфликт бизнес-правила (занято, дубликат) → 409. */
export class ConflictError extends DomainError {
  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message, 409, 'CONFLICT');
  }
}

/** Сбой соседнего сервиса (502): catalog/patient недоступны или ответ не ОК. */
export class UpstreamError extends DomainError {
  constructor(message: string) {
    super(message, 502, 'UPSTREAM_ERROR');
  }
}
