'use client';

import { useEffect, useState } from 'react';
import type { Appointment, AppointmentListResponse, Specialization } from '@mp/contracts';
import {
  Box,
  DataTable,
  MpAlert,
  MpButton,
  MpSelect,
  MpStatusBadge,
  PaginationBar,
  Stack,
} from '@/shared/ui';
import { formatSlot, usePagination } from '@/shared/lib';
import { browserApi } from '@/shared/api/browser';
import { toApiError } from '@/shared/api/errors';
import { VisitResultDialog } from '@/features/visit-result-dialog';

/**
 * История записей пациента (5.5, design/history.md): только СВОИ записи
 * (patientId сервер берёт из токена), фильтры статуса/специализации в URL,
 * серверная пагинация по 10, статусы — бейджи из mp-ui-kit.
 * Завершённые приёмы показывают результат read-only (5.5/9.2 AC).
 */

const LIMIT = 10;

const STATUS_OPTIONS = [
  { value: 'SUBMITTED', label: 'В ожидании' },
  { value: 'APPROVED', label: 'Принята' },
  { value: 'DECLINED', label: 'Отклонена' },
  { value: 'CANCELLED', label: 'Отменена' },
  { value: 'COMPLETED', label: 'Завершена' },
];

type Filters = { status?: string; specId?: string };

export function HistoryTable({
  initial,
  initialFilters,
  specializations,
}: {
  initial: AppointmentListResponse;
  initialFilters: Filters;
  specializations: Pick<Specialization, 'id' | 'name'>[];
}): React.JSX.Element {
  const [data, setData] = useState<AppointmentListResponse>(initial);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** Открытый результат приёма (просмотр read-only, 5.5 AC). */
  const [visitResult, setVisitResult] = useState<Appointment | null>(null);

  const pagination = usePagination({ limit: LIMIT, total: data.total });
  const { offset } = pagination;

  // Единый путь загрузки: смена страницы (URL) и фильтров ведёт сюда;
  // при маунте догружает страницу из URL, если это не SSR-offset (F5, AC 2.5)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    browserApi.scheduling
      .getMyAppointments({
        offset,
        limit: LIMIT,
        ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.specId ? { specId: filters.specId } : {}),
      })
      .then((response) => {
        if (cancelled) return;
        setData(response);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(toApiError(caught).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [offset, filters]);

  function changeFilter(key: keyof Filters, value: string): void {
    const next: Filters = { ...filters, [key]: value || undefined };
    setFilters(next);
    if (pagination.page !== 0) pagination.setPage(0);
  }

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ mb: 2, maxWidth: 640, alignItems: { sm: 'flex-end' } }}
      >
        <MpSelect
          label="Статус"
          placeholder="Все"
          value={filters.status ?? ''}
          options={STATUS_OPTIONS}
          onChange={(event) => changeFilter('status', event.target.value)}
          sx={{ minWidth: 200 }}
        />
        <MpSelect
          label="Специализация"
          placeholder="Все"
          value={filters.specId ?? ''}
          options={specializations.map((spec) => ({ value: spec.id, label: spec.name }))}
          onChange={(event) => changeFilter('specId', event.target.value)}
          sx={{ minWidth: 200 }}
        />
      </Stack>

      {error ? (
        <MpAlert severity="error" role="alert" sx={{ mb: 2 }}>
          {error}
        </MpAlert>
      ) : null}

      <DataTable<AppointmentListResponse['items'][number]>
        columns={[
          {
            key: 'slot',
            header: 'Дата и время',
            render: (item) => formatSlot(item.slot.localDate, item.slot.start),
          },
          { key: 'doctorName', header: 'Врач' },
          { key: 'specializationName', header: 'Специализация' },
          {
            key: 'status',
            header: 'Статус',
            render: (item) => <MpStatusBadge status={item.status} />,
          },
          {
            key: 'declineReason',
            header: 'Причина отказа',
            render: (item) => item.declineReason ?? '—',
          },
          {
            key: 'visitResult',
            header: 'Результат приёма',
            // Данные уже в списке API (без отдельного запроса) — только просмотра
            render: (item) =>
              item.visitResult ? (
                <MpButton size="small" onClick={() => setVisitResult(item)}>
                  Посмотреть
                </MpButton>
              ) : (
                '—'
              ),
          },
        ]}
        rows={data.items}
        rowKey={(item) => item.id}
        loading={loading}
        {...(error ? { error } : {})}
        emptyTitle="Записей пока нет"
        emptyDescription="Запишитесь к врачу, история появится здесь"
        emptyActionLabel="Записаться к врачу"
        emptyActionHref="/cabinet/record"
      />

      {data.total > 0 ? (
        <PaginationBar
          meta={{ ...pagination, total: data.total }}
          onPageChange={(page) => pagination.setPage(page)}
        />
      ) : null}

      {/* Результат приёма — только чтение: правка пациенту недоступна (5.5/9.2) */}
      <VisitResultDialog
        appointment={visitResult}
        open={visitResult !== null}
        onClose={() => setVisitResult(null)}
        viewOnly
      />
    </Box>
  );
}
