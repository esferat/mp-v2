/**
 * Unit of Work (hexagonal: порт в entities, Prisma-реализация в shared/api).
 * Generic по контексту: каждый сервис объявляет свой (SpecializationContext и т.д.),
 * сам порт не знает о доменных типах.
 */
export interface UnitOfWork<Ctx> {
  /** Выполняет fn в одной транзакции БД сервиса. */
  run<T>(fn: (ctx: Ctx) => Promise<T>): Promise<T>;
}

/** DI-токен привязки реализации (сборка — в app/app.module.ts). */
export const UNIT_OF_WORK = Symbol('CatalogUnitOfWork');
