import type { Specialization, SpecializationRepository } from '../../../entities/specialization';

/**
 * Запрос списка специализаций (3.3): чистая функция над портом —
 * тестируется без БД и без Nest-контейнера (0.7 AC).
 */
export async function getSpecializations(
  repository: SpecializationRepository,
): Promise<Specialization[]> {
  return repository.findAll();
}
