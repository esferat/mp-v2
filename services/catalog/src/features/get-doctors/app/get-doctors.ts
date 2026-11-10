import {
  type DoctorListItem,
  type DoctorListQuery,
  type DoctorRepository,
  type PhotoUrlSigner,
  toPublicDoctor,
} from '../../../entities/doctor';

/**
 * Список врачей (3.1): страница из репозитория + подпись фото (presigned,
 * TTL 5 мин). Поиск/пагинация — в репозитории; use-case оркестрирует и
 * убирает внутренний photoKey из ответа (тестируется без БД).
 */
export async function getDoctors(
  repository: DoctorRepository,
  signer: PhotoUrlSigner | undefined,
  query: DoctorListQuery,
): Promise<{ items: DoctorListItem[]; total: number }> {
  const { items, total } = await repository.findPage(query);
  const mapped = await Promise.all(items.map((item) => toPublicDoctor(item, signer)));
  return { items: mapped, total };
}
