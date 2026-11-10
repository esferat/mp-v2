import type { Specialization } from './specialization';

/**
 * Порт доступа к справочнику специализаций (hexagonal: интерфейс — в entities,
 * реализация Prisma — в shared/api, in-memory — в тестах).
 */
export interface SpecializationRepository {
  /** Все специализации с числом врачей (для админ-списка). */
  findAll(): Promise<Specialization[]>;

  /** Поиск по названию без учёта регистра (проверка дубликата). */
  findByName(name: string): Promise<Specialization | null>;

  findById(id: string): Promise<Specialization | null>;

  /** Создание; дубликат (уникальный индекс по нижнему регистру) → ConflictError. */
  create(name: string): Promise<Specialization>;

  /** Удаление; отсутствие — тихо (идемпотентность). */
  delete(id: string): Promise<void>;
}

/** DI-токен привязки реализации (сборка — в app/app.module.ts). */
export const SPECIALIZATION_REPOSITORY = Symbol('CatalogSpecializationRepository');
