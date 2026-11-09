'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DoctorListQuery, DoctorListResponse, DoctorStatus } from '@mp/contracts';
import { browserApi } from '@/shared/api/browser';
import { toApiError } from '@/shared/api/errors';

/**
 * Поиск врачей без перезагрузки страницы (3.1 AC: «поиск обновляет список
 * без перезагрузки»): debounce-запрос в BFF ('/api/bff/catalog/doctors'),
 * состояния loading/error единые (2.4).
 *
 * Сюда же сведены фильтры списка (3.1, макет design/doctors-list.md:
 * «специализация/статус») — один путь запроса для поиска, фильтров и пагинации.
 */
export interface DoctorsSearchState {
  search: string;
  setSearch: (value: string) => void;
  result: DoctorListResponse | null;
  loading: boolean;
  error: string | null;
  requestId?: string;
  /** Повторить последний запрос (кнопка «Повторить», 2.4). */
  retry: () => void;
}

/** Фильтры списка врачей (3.1): значения — из select'ов в виджете. */
export interface DoctorsFilters {
  specId?: string;
  status?: DoctorStatus;
}

const DEBOUNCE_MS = 300;

export function useDoctorsSearch(options: {
  offset: number;
  limit: number;
  filters?: DoctorsFilters;
}): DoctorsSearchState {
  const { offset, limit, filters } = options;
  const specId = filters?.specId;
  const status = filters?.status;
  const hasFilters = Boolean(specId ?? status);

  const [search, setSearch] = useState('');
  const [result, setResult] = useState<DoctorListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);

  const sequence = useRef(0);
  const query = search.trim();

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    // Пустые поиск и фильтры на первой странице — показываем SSR-данные (без лишнего запроса)
    if (!query && !hasFilters && offset === 0 && attempt === 0) {
      setResult(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const id = (sequence.current += 1);
      setLoading(true);
      setError(null);
      setRequestId(undefined);

      try {
        const response = await browserApi.catalog.getDoctors({
          ...(query ? { search: query } : {}),
          ...(specId ? { specId } : {}),
          ...(status ? { status } : {}),
          offset,
          limit,
        });
        // Ответ устаревшего запроса не перетекает в UI (гонка ввода)
        if (id === sequence.current) {
          setResult(response);
          setLoading(false);
        }
      } catch (caught) {
        if (id !== sequence.current) return;
        const apiError = toApiError(caught);
        setError(apiError.message);
        setRequestId(apiError.requestId);
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, specId, status, hasFilters, offset, limit, attempt]);

  return { search, setSearch, result, loading, error, requestId, retry };
}

/** Запрос списка для пагинации (используется виджетом при смене страницы). */
export async function fetchDoctorsPage(
  params: Partial<DoctorListQuery> & { offset: number; limit: number },
): Promise<DoctorListResponse> {
  return browserApi.catalog.getDoctors(params);
}
