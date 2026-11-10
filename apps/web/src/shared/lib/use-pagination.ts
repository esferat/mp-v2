'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Пагинация (задача 2.5): offset/limit, накопление страниц, состояние
 * загрузки. Номер страницы синхронизируется с query-параметрами URL —
 * после F5 пользователь остаётся на той же странице (AC 2.5).
 *
 * Хук переиспользуется во всех таблицах (эпики 3, 4, 5, 7) без модификаций.
 */

export interface PaginationMeta {
  /** 0-based номер страницы. */
  page: number;
  limit: number;
  /** Смещение для API-запроса. */
  offset: number;
  /** Число элементов всего (если известно из ответа API). */
  total: number;
  /** Сколько страниц (при известном total; иначе — без ограничения). */
  pageCount: number;
  previousDisabled: boolean;
  nextDisabled: boolean;
}

export interface UsePaginationOptions {
  /** Размер страницы (limit). */
  limit?: number;
  /** Всего элементов; 0 — пока не известно. */
  total?: number;
  /** Число загруженных страниц (накопление): если > page+1 — есть «следующая». */
  loadedPages?: number;
}

/** Ключ номера страницы в URL (восстановление после F5 — AC 2.5). */
export const PAGE_PARAM = 'page';

/** Ключ размера страницы в URL (макеты: «На странице: 10 ▾», шаги 10/25/50). */
export const LIMIT_PARAM = 'limit';

/** Чистый расчёт состояния (тестируется без React/Next). */
export function computePagination({
  page,
  limit,
  total,
  loadedPages,
}: {
  page: number;
  limit: number;
  total: number;
  loadedPages: number;
}): PaginationMeta {
  const pageCount = total > 0 ? Math.ceil(total / limit) : loadedPages;
  const previousDisabled = page <= 0;
  // «Следующая» есть, если: известен total и страница не последняя,
  // либо total неизвестен, но уже загружено больше текущей страницы
  const nextDisabled = total > 0 ? page + 1 >= pageCount : pageCount === 0 || page + 1 >= pageCount;

  return {
    page,
    limit,
    offset: page * limit,
    total,
    pageCount,
    previousDisabled,
    nextDisabled,
  };
}

export function usePagination(options: UsePaginationOptions = {}): PaginationMeta & {
  /** Перейти к странице (0-based); клипует к допустимому диапазону. */
  setPage: (page: number) => void;
  /** Сменить размер страницы (10/25/50) — сбрасывает на первую. */
  setLimit: (limit: number) => void;
  previous: () => void;
  next: () => void;
  /** Состояние «загрузка» — передаётся таблицей при запросе новой страницы. */
  loading: boolean;
  withLoading: <T>(task: () => Promise<T>) => Promise<T>;
} {
  const { limit = 20, total = 0, loadedPages = 0 } = options;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlPage = Number(searchParams.get(PAGE_PARAM) ?? '0');
  const page = Number.isFinite(urlPage) && urlPage > 0 ? Math.floor(urlPage) : 0;

  // Размер страницы тоже живёт в URL: «На странице: 10 ▾» восстанавливается после F5
  const urlLimit = Number(searchParams.get(LIMIT_PARAM) ?? '0');
  const effectiveLimit = Number.isFinite(urlLimit) && urlLimit > 0 ? Math.floor(urlLimit) : limit;

  const [loading, setLoading] = useState(false);

  const pushParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const query = params.toString();
      // push (не replace) — «назад» в браузере возвращает на предыдущую страницу
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [router, pathname, searchParams],
  );

  const setPage = useCallback(
    (nextPage: number) => {
      pushParams((params) => {
        if (nextPage > 0) params.set(PAGE_PARAM, String(nextPage));
        else params.delete(PAGE_PARAM);
      });
    },
    [pushParams],
  );

  /** Смена размера страницы: сбрасывает на первую страницу (макеты, AC 2.5). */
  const setLimit = useCallback(
    (nextLimit: number) => {
      pushParams((params) => {
        params.delete(PAGE_PARAM);
        if (nextLimit !== limit) params.set(LIMIT_PARAM, String(nextLimit));
        else params.delete(LIMIT_PARAM);
      });
    },
    [pushParams, limit],
  );

  const meta = useMemo(
    () => computePagination({ page, limit: effectiveLimit, total, loadedPages }),
    [page, effectiveLimit, total, loadedPages],
  );

  return {
    ...meta,
    setPage,
    setLimit,
    previous: () => setPage(Math.max(0, page - 1)),
    next: () => setPage(page + 1),
    loading,
    /** Обёртка запроса: автоматически ставит/снимает состояние загрузки. */
    withLoading: async <T>(task: () => Promise<T>): Promise<T> => {
      setLoading(true);
      try {
        return await task();
      } finally {
        setLoading(false);
      }
    },
  };
}
