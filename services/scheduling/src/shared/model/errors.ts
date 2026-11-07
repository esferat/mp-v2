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

/** Конфликт слота (409): уникальный индекс брони уже занят (5.3 AC: SLOT_TAKEN). */
export class SlotTakenError extends DomainError {
  constructor() {
    super('Слот уже занят', 409, 'SLOT_TAKEN');
  }
}

/** Недопустимый переход статуса записи (409, канон §1 / 5.4 AC). */
export class InvalidTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super(`Переход ${from} → ${to} не разрешён`, 409, 'INVALID_TRANSITION');
  }
}

/** Доступ запрещён (403): чужая запись/документ или нет привязки врача (9.2/9.3). */
export class ForbiddenError extends DomainError {
  constructor(message: string) {
    super(message, 403, 'FORBIDDEN');
  }
}

/** Сбой соседнего сервиса (502): patient/catalog недоступны или ответ не ОК. */
export class UpstreamError extends DomainError {
  constructor(message: string) {
    super(message, 502, 'UPSTREAM_ERROR');
  }
}
