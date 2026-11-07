import type {
  DoctorListItem,
  DoctorListQuery,
  DoctorRepository,
  PhotoUrlSigner,
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

  const mapped = await Promise.all(
    items.map(async (item): Promise<DoctorListItem> => {
      // Явная сборка: photoKey (внутренний ключ MinIO) не попадает в ответ
      const base: DoctorListItem = {
        id: item.id,
        firstName: item.firstName,
        lastName: item.lastName,
        ...(item.middleName ? { middleName: item.middleName } : {}),
        specializationId: item.specializationId,
        specializationName: item.specializationName,
        status: item.status,
        schedule: item.schedule,
      };

      if (item.photoKey && signer) {
        return { ...base, photoUrl: await signer.sign(item.photoKey) };
      }
      return base;
    }),
  );

  return { items: mapped, total };
}
