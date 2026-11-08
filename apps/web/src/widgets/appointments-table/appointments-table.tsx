'use client';

import { useEffect, useState } from 'react';
import type { AppointmentListResponse, Specialization } from '@mp/contracts';
import {
  Box,
  AppModal,
  DataTable,
  DatePickersProvider,
  DateRangeField,
  FormField,
  MpAlert,
  MpButton,
  MpSelect,
  MpStatusBadge,
  PaginationBar,
  Stack,
  useToast,
} from '@/shared/ui';
import { formatSlot, usePagination } from '@/shared/lib';
import { browserApi } from '@/shared/api/browser';
import { ApiError, toApiError } from '@/shared/api/errors';

/**
 * Управление записями (5.4, design/appointments.md): фильтры в URL,
 * серверная пагинация по 10, действия APPROVED/DECLINED/CANCELLED —
 * через статусную машину сервиса (409 при недопустимом переходе).
 */

const LIMIT = 10;

const STATUS_OPTIONS = [
  { value: 'SUBMITTED', label: 'В ожидании' },
  { value: 'APPROVED', label: 'Принята' },
  { value: 'DECLINED', label: 'Отклонена' },
  { value: 'CANCELLED', label: 'Отменена' },
  { value: 'COMPLETED', label: 'Завершена' },
];

type Filters = {
  status?: string;
  specId?: string;
  doctorId?: string;
  from?: string;
  to?: string;
};

export function AppointmentsTable({
  initial,
  initialFilters,
  specializations,
  doctors,
}: {
  initial: AppointmentListResponse;
  initialFilters: Filters;
  specializations: Pick<Specialization, 'id' | 'name'>[];
  doctors: Array<{ id: string; name: string }>;
}): React.JSX.Element {
  const toast = useToast();
  const [data, setData] = useState<AppointmentListResponse>(initial);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** Причина отказа: {appointmentId} — открыт диалог. */
  const [declineFor, setDeclineFor] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  /** Отмена записи: открыт диалог подтверждения. */
  const [cancelFor, setCancelFor] = useState<string | null>(null);
  /** Идентификатор выполняющегося действия (защита от двойного клика). */
  const [busyId, setBusyId] = useState<string | null>(null);

  const pagination = usePagination({ limit: LIMIT, total: data.total });
  const { offset } = pagination;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    browserApi.scheduling
      .getAppointments({
        offset,
        limit: LIMIT,
        ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.specId ? { specId: filters.specId } : {}),
        ...(filters.doctorId ? { doctorId: filters.doctorId } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
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

  function setFilter(key: keyof Filters, value: string): void {
    const next: Filters = { ...filters, [key]: value || undefined };
    setFilters(next);
    if (pagination.page !== 0) pagination.setPage(0);
  }

  async function runAction(
    id: string,
    action: () => Promise<unknown>,
    successMessage: string,
  ): Promise<void> {
    if (busyId) return;
    setBusyId(id);
    try {
      await action();
      toast.success(successMessage);
      // Обновление списка: refetch текущей страницы (invalidation, 5.4 AC)
      const response = await browserApi.scheduling.getAppointments({
        offset,
        limit: LIMIT,
        ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.specId ? { specId: filters.specId } : {}),
        ...(filters.doctorId ? { doctorId: filters.doctorId } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
      });
      setData(response);
    } catch (caught) {
      const apiError: ApiError = toApiError(caught);
      toast.error(apiError.message, apiError.requestId);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Box>
      <DatePickersProvider>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ mb: 2, alignItems: { sm: 'flex-end' } }}
        >
          <DateRangeField
            from={filters.from ? new Date(filters.from) : null}
            to={filters.to ? new Date(filters.to) : null}
            onFromChange={(value) =>
              setFilter('from', value ? value.toISOString().slice(0, 10) : '')
            }
            onToChange={(value) => setFilter('to', value ? value.toISOString().slice(0, 10) : '')}
          />
          <MpSelect
            label="Статус"
            placeholder="Все"
            value={filters.status ?? ''}
            options={STATUS_OPTIONS}
            onChange={(event) => setFilter('status', event.target.value)}
            sx={{ minWidth: 180 }}
          />
          <MpSelect
            label="Специализация"
            placeholder="Все"
            value={filters.specId ?? ''}
            options={specializations.map((spec) => ({ value: spec.id, label: spec.name }))}
            onChange={(event) => setFilter('specId', event.target.value)}
            sx={{ minWidth: 180 }}
          />
          <MpSelect
            label="Врач"
            placeholder="Все"
            value={filters.doctorId ?? ''}
            options={doctors.map((doctor) => ({ value: doctor.id, label: doctor.name }))}
            onChange={(event) => setFilter('doctorId', event.target.value)}
            sx={{ minWidth: 180 }}
          />
        </Stack>
      </DatePickersProvider>

      {error ? (
        <MpAlert severity="error" role="alert" sx={{ mb: 2 }}>
          {error}
        </MpAlert>
      ) : null}

      <DataTable<AppointmentListResponse['items'][number]>
        columns={[
          { key: 'patientName', header: 'Пациент' },
          { key: 'doctorName', header: 'Врач' },
          { key: 'specializationName', header: 'Специализация' },
          {
            key: 'slot',
            header: 'Время приёма',
            render: (item) => formatSlot(item.slot.localDate, item.slot.start),
          },
          {
            key: 'status',
            header: 'Статус',
            render: (item) => <MpStatusBadge status={item.status} />,
          },
          {
            key: 'actions',
            header: '',
            render: (item) => {
              const busy = busyId === item.id;
              return (
                <Stack direction="row" spacing={1}>
                  {item.status === 'SUBMITTED' ? (
                    <>
                      <MpButton
                        size="small"
                        variant="outlined"
                        color="success"
                        loading={busy}
                        onClick={() =>
                          void runAction(
                            item.id,
                            () =>
                              browserApi.scheduling.setAppointmentStatus(item.id, {
                                status: 'APPROVED',
                              }),
                            'Запись принята',
                          )
                        }
                      >
                        Принять
                      </MpButton>
                      <MpButton
                        size="small"
                        variant="outlined"
                        color="error"
                        disabled={busy}
                        onClick={() => {
                          setDeclineReason('');
                          setDeclineFor(item.id);
                        }}
                      >
                        Отклонить
                      </MpButton>
                    </>
                  ) : null}
                  {item.status === 'SUBMITTED' || item.status === 'APPROVED' ? (
                    <MpButton
                      size="small"
                      variant="text"
                      color="inherit"
                      disabled={busy}
                      onClick={() => setCancelFor(item.id)}
                    >
                      Отменить
                    </MpButton>
                  ) : null}
                </Stack>
              );
            },
          },
        ]}
        rows={data.items}
        rowKey={(item) => item.id}
        loading={loading}
        {...(error ? { error } : {})}
        emptyTitle="Записей нет"
        emptyDescription="За выбранными фильтрами ничего не найдено"
      />

      {data.total > 0 ? (
        <PaginationBar
          meta={{ ...pagination, total: data.total }}
          onPageChange={(page) => pagination.setPage(page)}
        />
      ) : null}

      {/* Отклонение: причина обязательна (канон §1, 5.4) */}
      <AppModal
        open={declineFor !== null}
        title="Причина отклонения"
        closeLabel="Закрыть"
        confirmLabel="Отклонить запись"
        confirmDisabled={declineReason.trim().length < 3}
        onClose={() => setDeclineFor(null)}
        onConfirm={() => {
          const id = declineFor;
          const reason = declineReason.trim();
          setDeclineFor(null);
          if (!id) return;
          void runAction(
            id,
            () => browserApi.scheduling.setAppointmentStatus(id, { status: 'DECLINED', reason }),
            'Запись отклонена',
          );
        }}
      >
        <FormField
          label="Причина (от 3 символов)"
          name="decline-reason"
          value={declineReason}
          onChange={setDeclineReason}
          required
          multiline
          rows={2}
        />
      </AppModal>

      {/* Отмена: подтверждение (из SUBMITTED/APPROVED, канон §1) */}
      <AppModal
        open={cancelFor !== null}
        title="Отменить запись?"
        closeLabel="Не отменять"
        confirmLabel="Отменить запись"
        onClose={() => setCancelFor(null)}
        onConfirm={() => {
          const id = cancelFor;
          setCancelFor(null);
          if (!id) return;
          void runAction(
            id,
            () => browserApi.scheduling.cancelAppointment(id, {}),
            'Запись отменена',
          );
        }}
      >
        Пациент увидит отмену в истории. Действие необратимо: повторная отмена невозможна.
      </AppModal>
    </Box>
  );
}
