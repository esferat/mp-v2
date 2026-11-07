'use client';

import { useEffect, useState } from 'react';
import type { Appointment, AppointmentListQuery, AppointmentListResponse } from '@mp/contracts';
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
import { formatSlot, PERIOD_OPTIONS, periodRange, usePagination } from '@/shared/lib';
import { browserApi } from '@/shared/api/browser';
import { toApiError } from '@/shared/api/errors';
import { VisitResultDialog } from '@/features/visit-result-dialog';

/**
 * Приёмы врача (9.2, design/doctor-schedule.md): видны только СВОИ записи
 * (doctorId сервер берёт из привязки sub), фильтры в URL (F5 восстанавливает),
 * серверная пагинация по 10. Действия: «Внести результат» (APPROVED) и
 * «Посмотреть» (COMPLETED) — диалог результата приёма (9.2).
 */

const LIMIT = 10;

const STATUS_OPTIONS = [
  { value: 'SUBMITTED', label: 'В ожидании' },
  { value: 'APPROVED', label: 'Принята' },
  { value: 'DECLINED', label: 'Отклонена' },
  { value: 'CANCELLED', label: 'Отменена' },
  { value: 'COMPLETED', label: 'Завершена' },
];

type Filters = { status?: string; period: string };

export function DoctorAppointmentsTable({
  initial,
  initialFilters,
}: {
  initial: AppointmentListResponse;
  initialFilters: Filters;
}): React.JSX.Element {
  const [data, setData] = useState<AppointmentListResponse>(initial);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** Запись, для которой открыт диалог результата. */
  const [dialogFor, setDialogFor] = useState<Appointment | null>(null);

  const pagination = usePagination({ limit: LIMIT, total: data.total });
  const { offset } = pagination;

  function requestParams(nextFilters: Filters, nextOffset: number): AppointmentListQuery {
    const range = periodRange(nextFilters.period);
    return {
      offset: nextOffset,
      limit: LIMIT,
      ...(nextFilters.status
        ? { status: nextFilters.status as NonNullable<AppointmentListQuery['status']> }
        : {}),
      ...(range.from ? { from: range.from } : {}),
      ...(range.to ? { to: range.to } : {}),
    };
  }

  // Единый путь загрузки: смена страницы/фильтров → запрос своих записей
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    browserApi.scheduling
      .getDoctorAppointments(requestParams(filters, offset))
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

  function setFilter(key: keyof Filters, value: string): void {
    const next: Filters = { ...filters, [key]: value };
    setFilters(next);
    if (pagination.page !== 0) pagination.setPage(0);
  }

  /** Обновление после действия в диалоге (invalidate текущей страницы). */
  function refresh(): void {
    setLoading(true);
    browserApi.scheduling
      .getDoctorAppointments(requestParams(filters, offset))
      .then((response) => {
        setData(response);
        setError(null);
      })
      .catch((caught: unknown) => setError(toApiError(caught).message))
      .finally(() => setLoading(false));
  }

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ mb: 2, alignItems: { sm: 'flex-end' } }}
      >
        <MpSelect
          label="Период"
          value={filters.period}
          options={PERIOD_OPTIONS}
          onChange={(event) => setFilter('period', event.target.value)}
          sx={{ minWidth: 180 }}
        />
        <MpSelect
          label="Статус"
          placeholder="Все"
          value={filters.status ?? ''}
          options={STATUS_OPTIONS}
          onChange={(event) => setFilter('status', event.target.value)}
          sx={{ minWidth: 180 }}
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
          { key: 'patientName', header: 'Пациент' },
          { key: 'specializationName', header: 'Специализация' },
          {
            key: 'status',
            header: 'Статус',
            render: (item) => <MpStatusBadge status={item.status} />,
          },
          {
            key: 'result',
            header: 'Результат',
            render: (item) =>
              item.status === 'COMPLETED' ? (
                <MpStatusBadge status="COMPLETED" label="✓ Есть" />
              ) : (
                '—'
              ),
          },
          {
            key: 'actions',
            header: '',
            render: (item) => {
              if (item.status === 'APPROVED') {
                return (
                  <MpButton size="small" variant="outlined" onClick={() => setDialogFor(item)}>
                    Внести результат
                  </MpButton>
                );
              }
              if (item.status === 'COMPLETED') {
                return (
                  <MpButton size="small" variant="text" onClick={() => setDialogFor(item)}>
                    Посмотреть
                  </MpButton>
                );
              }
              return null;
            },
          },
        ]}
        rows={data.items}
        rowKey={(item) => item.id}
        loading={loading}
        {...(error ? { error } : {})}
        emptyTitle="Приёмов за период нет"
        emptyDescription="Измените период или статус"
      />

      {data.total > 0 ? (
        <PaginationBar
          meta={{ ...pagination, total: data.total }}
          onPageChange={(page) => pagination.setPage(page)}
        />
      ) : null}

      <VisitResultDialog
        appointment={dialogFor}
        open={dialogFor !== null}
        onClose={() => setDialogFor(null)}
        onChanged={refresh}
      />
    </Box>
  );
}
