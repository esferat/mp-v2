'use client';

import { useEffect, useState } from 'react';
import type { Appointment, AppointmentListResponse, Specialization } from '@mp/contracts';
import {
  AppModal,
  Box,
  DataTable,
  DatePickersProvider,
  DateRangeField,
  FormField,
  MpAlert,
  MpAutocomplete,
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
import { RescheduleDialog } from '@/features/reschedule-appointment';

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
  /** Мультивыбор специализаций (поиск + мультиселект в одном поле). */
  specIds?: string[];
  /** Мультивыбор врачей (поиск + мультиселект в одном поле). */
  doctorIds?: string[];
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
  /** Справочник врачей: специализация нужна для загрузки слотов (10.3). */
  doctors: Array<{ id: string; name: string; specializationId?: string }>;
}): React.JSX.Element {
  const toast = useToast();
  const [data, setData] = useState<AppointmentListResponse>(initial);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** Принудительное обновление списка (после переноса, 10.3). */
  const [reloadKey, setReloadKey] = useState(0);
  /** Открытый диалог переноса (10.3). */
  const [rescheduleFor, setRescheduleFor] = useState<Appointment | null>(null);
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
        limit: pagination.limit,
        ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.specIds?.length ? { specIds: filters.specIds } : {}),
        ...(filters.doctorIds?.length ? { doctorIds: filters.doctorIds } : {}),
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
  }, [offset, pagination.limit, filters, reloadKey]);

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
        limit: pagination.limit,
        ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.specIds?.length ? { specIds: filters.specIds } : {}),
        ...(filters.doctorIds?.length ? { doctorIds: filters.doctorIds } : {}),
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
        {/* Фильтры по строкам: период+статус+сброс, затем специализация, затем врач */}
        <Stack spacing={2} sx={{ mb: 2 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            useFlexGap
            sx={{ alignItems: { sm: 'flex-end' }, flexWrap: 'wrap' }}
          >
            {/* Период: два поля в фиксированной ширине (иначе fullWidth занимает всю строку) */}
            <Box sx={{ display: 'flex', gap: 2, width: 360, flexShrink: 0 }}>
              <DateRangeField
                from={filters.from ? new Date(filters.from) : null}
                to={filters.to ? new Date(filters.to) : null}
                onFromChange={(value) =>
                  setFilter('from', value ? value.toISOString().slice(0, 10) : '')
                }
                onToChange={(value) =>
                  setFilter('to', value ? value.toISOString().slice(0, 10) : '')
                }
              />
            </Box>
            <MpSelect
              label="Статус"
              placeholder="Все"
              size="small"
              fullWidth={false}
              value={filters.status ?? ''}
              options={STATUS_OPTIONS}
              onChange={(event) => setFilter('status', event.target.value)}
              sx={{ minWidth: 180 }}
            />
            {/* Сброс фильтров — нейтральная кнопка (visual/appointments.html) */}
            <MpButton
              color="neutral"
              variant="outlined"
              size={'medium'}
              disabled={
                !filters.status &&
                !filters.specIds?.length &&
                !filters.doctorIds?.length &&
                !filters.from &&
                !filters.to
              }
              onClick={() => {
                setFilters({});
                if (pagination.page !== 0) pagination.setPage(0);
              }}
            >
              Сбросить
            </MpButton>
          </Stack>

          {/* Специализация: поиск + мультиселект (как у врача, максимум 10 опций) */}
          <MpAutocomplete
            label="Специализация"
            multiple
            disableCloseOnSelect
            placeholder="Поиск по названию"
            options={specializations}
            getOptionLabel={(spec) => spec.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            value={specializations.filter((spec) => filters.specIds?.includes(spec.id))}
            onChange={(_, value) => {
              const ids = value.map((spec) => spec.id);
              setFilters((prev) => ({ ...prev, specIds: ids.length > 0 ? ids : undefined }));
              if (pagination.page !== 0) pagination.setPage(0);
            }}
            sx={{ maxWidth: 480 }}
          />

          {/* Врач: поиск + мультиселект в одном поле (видно максимум 10 опций) */}
          <MpAutocomplete
            label="Врач"
            multiple
            disableCloseOnSelect
            placeholder="Поиск по ФИО"
            options={doctors}
            getOptionLabel={(doctor) => doctor.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            value={doctors.filter((doctor) => filters.doctorIds?.includes(doctor.id))}
            onChange={(_, value) => {
              const ids = value.map((doctor) => doctor.id);
              setFilters((prev) => ({ ...prev, doctorIds: ids.length > 0 ? ids : undefined }));
              if (pagination.page !== 0) pagination.setPage(0);
            }}
            sx={{ maxWidth: 480 }}
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
            mono: true,
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
                      {/* По макету (appointments.html): «✓ Принять» — contained, «✗ Отклонить» — danger */}
                      <MpButton
                        size="small"
                        variant="contained"
                        color="primary"
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
                        ✓ Принять
                      </MpButton>
                      <MpButton
                        size="small"
                        variant="contained"
                        color="error"
                        disabled={busy}
                        onClick={() => {
                          setDeclineReason('');
                          setDeclineFor(item.id);
                        }}
                      >
                        ✗ Отклонить
                      </MpButton>
                    </>
                  ) : null}
                  {item.status === 'SUBMITTED' || item.status === 'APPROVED' ? (
                    <>
                      {/* Перенос (10.3): врач/дата/слот без смены статуса */}
                      <MpButton
                        size="small"
                        variant="text"
                        color="neutral"
                        disabled={busy}
                        onClick={() => setRescheduleFor(item)}
                      >
                        Перенести
                      </MpButton>
                      <MpButton
                        size="small"
                        variant="text"
                        color="inherit"
                        disabled={busy}
                        onClick={() => setCancelFor(item.id)}
                      >
                        Отменить
                      </MpButton>
                    </>
                  ) : null}
                </Stack>
              );
            },
          },
        ]}
        rows={data.items}
        rowKey={(item) => item.id}
        loading={loading}
        pageSize={pagination.limit}
        {...(error ? { error } : {})}
        emptyTitle="Записей нет"
        emptyDescription="За выбранными фильтрами ничего не найдено"
        footer={
          data.total > 0 ? (
            <PaginationBar
              meta={{ ...pagination, total: data.total }}
              onPageChange={(page) => pagination.setPage(page)}
              onLimitChange={pagination.setLimit}
            />
          ) : undefined
        }
      />

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

      {/* Перенос (10.3): условный монтирование — состояние сбрасывается при открытии */}
      {rescheduleFor ? (
        <RescheduleDialog
          appointment={rescheduleFor}
          doctors={doctors}
          open
          onClose={() => setRescheduleFor(null)}
          onChanged={() => {
            setRescheduleFor(null);
            setReloadKey((key) => key + 1);
          }}
        />
      ) : null}
    </Box>
  );
}
