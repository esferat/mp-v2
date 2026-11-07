'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PatientListResponse } from '@mp/contracts';
import { browserApi } from '@/shared/api/browser';
import { toApiError } from '@/shared/api/errors';

/**
 * Поиск пациентов без перезагрузки страницы (4.1 AC): debounce-запрос в BFF
 * по ФИО/email, состояния loading/error единые (2.4) — паттерн поиска врачей.
 */
export interface PatientsSearchState {
  search: string;
  setSearch: (value: string) => void;
  result: PatientListResponse | null;
  loading: boolean;
  error: string | null;
  requestId?: string;
  retry: () => void;
}

const DEBOUNCE_MS = 300;

export function usePatientsSearch(options: { offset: number; limit: number }): PatientsSearchState {
  const { offset, limit } = options;

  const [search, setSearch] = useState('');
  const [result, setResult] = useState<PatientListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);

  const sequence = useRef(0);
  const query = search.trim();

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    // Пустой поиск на первой странице — показываем SSR-данные
    if (!query && offset === 0 && attempt === 0) {
      setResult(null);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      const id = (sequence.current += 1);
      setLoading(true);
      setError(null);
      setRequestId(undefined);

      try {
        const response = await browserApi.patient.list({
          ...(query ? { search: query } : {}),
          offset,
          limit,
        });
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

    return () => clearTimeout(timer);
  }, [query, offset, limit, attempt]);

  return { search, setSearch, result, loading, error, requestId, retry };
}

/** Запрос страницы списка (пагинация виджета). */
export async function fetchPatientsPage(params: {
  search?: string;
  offset: number;
  limit: number;
}): Promise<PatientListResponse> {
  return browserApi.patient.list(params);
}
