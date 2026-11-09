import { revalidateTag, unstable_cache } from 'next/cache';
import type { Specialization } from '@mp/contracts';
import type { Api } from './namespaces';

/**
 * Серверный кэш справочников (2.6, чек-лист: «revalidate/revalidateTag,
 * инвалидация по событиям doctor.updated.v1 / specialization.changed.v1»).
 *
 * Как закрыта инвалидация по событиям: эти события порождаются изменениями
 * справочников, которые приходят через витрину (BFF) — после успешной мутации
 * `revalidateCatalog()` сбрасывает тег сразу; TTL — страховка от изменений
 * мимо витрины (скрипты, прямые вызовы gateway).
 *
 * NB: модуль серверный — импортировать только из Server Components/route
 * handlers (import 'next/cache' в клиентский бандл не попадает).
 */

export const CATALOG_TAGS = {
  doctors: 'catalog-doctors',
  specializations: 'catalog-specializations',
} as const;

export type CatalogTag = (typeof CATALOG_TAGS)[keyof typeof CATALOG_TAGS];

/** TTL-страховка (сек): изменения мимо витрины устаревают не дольше минуты. */
export const CATALOG_REVALIDATE_SECONDS = 60;

/** Обёртка над unstable_cache для справочников: тег + TTL в одном месте. */
export function cachedCatalog<T>(
  parts: string[],
  tag: CatalogTag,
  fetcher: () => Promise<T>,
): Promise<T> {
  return unstable_cache(fetcher, ['catalog', tag, ...parts], {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: [tag],
  })();
}

/**
 * Тег по пути BFF-прокси (`/catalog/doctors/1?x=2` → tag); `null` — не справочник.
 * Сравнение по сегментам, чтобы `/catalog/doctors-x` не цеплялся к тегу врачей.
 * Чистая функция (тестируется без Next runtime).
 */
export function catalogTagForPath(pathname: string): string | null {
  const path = (pathname.split('?')[0] ?? '').replace(/^\/+/, '');
  const [root, resource] = path.split('/');
  if (root !== 'catalog') return null;
  if (resource === 'specializations') return CATALOG_TAGS.specializations;
  if (resource === 'doctors') return CATALOG_TAGS.doctors;
  return null;
}

/** Инвалидация кэша после успешной мутации через BFF (вызывать в route handler). */
export function revalidateCatalog(pathname: string): void {
  const tag = catalogTagForPath(pathname);
  if (!tag) return;
  // Next 16: второй аргумент обязателен (иначе deprecation) — профиль жизни
  // записи; инвалидация помечает всё, что записано до этого момента, устаревшим,
  // поэтому следующий SSR-рендер пересчитывает справочник.
  revalidateTag(tag, 'max');
}

/** Справочник специализаций — одна точка SSR-запросов (кэшируется по тегу). */
export function getSpecializationsCached(api: Api): Promise<Specialization[]> {
  return cachedCatalog(['specializations'], CATALOG_TAGS.specializations, () =>
    api.catalog.getSpecializations(),
  );
}
