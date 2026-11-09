'use client';

import { useEffect, useState } from 'react';
import type {
  DoctorListItem,
  DoctorListResponse,
  DoctorStatus,
  Specialization,
} from '@mp/contracts';
import {
  Alert,
  Box,
  DataTable,
  MpTextField,
  MpSelect,
  LinkButton,
  MpAvatar,
  PaginationBar,
  Stack,
  StatusBadge,
} from '@/shared/ui';
import { useDoctorsSearch, type DoctorsFilters } from '@/features/search-doctors';
import { usePagination } from '@/shared/lib';

const LIMIT = 10;

/** Статусы для фильтра (3.1, макет design/doctors-list.md: «специализация/статус»). */
const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Активен' },
  { value: 'INACTIVE', label: 'Архив' },
];

/**
 * Таблица врачей (3.1, widgets/doctors-table): SSR-данные приходят сверху,
 * поиск/фильтры/пагинация идут одним путём — debounce-запрос хука в BFF
 * ('/api/bff/catalog/doctors'), состояния loading/error единые (2.4/3.1 AC).
 * Номер страницы живёт в URL — F5 восстанавливает состояние (AC 2.5).
 */
export function DoctorsTable({
  initial,
  specializations,
}: {
  initial: DoctorListResponse;
  /** Справочник для фильтра «Специализация»: загружает SSR-страница (live). */
  specializations: Pick<Specialization, 'id' | 'name'>[];
}): React.JSX.Element {
  const [filters, setFilters] = useState<DoctorsFilters>({});
  /**
   * total живёт отдельно: page/offset приходят из URL и не зависят от total —
   * это разрывает цикл «offset → запрос → total → pagination».
   */
  const [total, setTotal] = useState(initial.total);

  const pagination = usePagination({ limit: LIMIT, total });
  const searchState = useDoctorsSearch({
    offset: pagination.offset,
    limit: LIMIT,
    filters,
  });

  // Данные: ответ хука (поиск/фильтры/страница) либо SSR-первая страница
  const view = searchState.result ?? initial;
  const searchActive = searchState.search.trim().length > 0;
  const filtered = searchActive || Boolean(filters.specId ?? filters.status);
  const error = searchState.error;

  useEffect(() => {
    setTotal(view.total);
  }, [view.total]);

  /** Смена фильтра всегда начинает с первой страницы (3.1). */
  function changeFilter(key: keyof DoctorsFilters, value: string): void {
    setFilters((prev) => ({
      ...prev,
      ...(key === 'status'
        ? { status: (value || undefined) as DoctorStatus | undefined }
        : { specId: value || undefined }),
    }));
    if (pagination.page !== 0) pagination.setPage(0);
  }

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ mb: 2, maxWidth: 720, alignItems: { sm: 'flex-end' } }}
      >
        <MpTextField
          label="Поиск по ФИО"
          name="doctor-search"
          size="small"
          value={searchState.search}
          onChange={(event) => searchState.setSearch(event.target.value)}
          placeholder="Иванов, Петров или Сидоров"
          error={searchState.error !== null && searchActive}
          {...(searchActive && searchState.error
            ? { helperText: `${searchState.error}${requestIdText(searchState.requestId)}` }
            : {})}
          sx={{ minWidth: 240 }}
        />
        <MpSelect
          label="Специализация"
          placeholder="Все"
          value={filters.specId ?? ''}
          options={specializations.map((spec) => ({ value: spec.id, label: spec.name }))}
          onChange={(event) => changeFilter('specId', event.target.value)}
          sx={{ minWidth: 200 }}
        />
        <MpSelect
          label="Статус"
          placeholder="Все"
          value={filters.status ?? ''}
          options={STATUS_OPTIONS}
          onChange={(event) => changeFilter('status', event.target.value)}
          sx={{ minWidth: 150 }}
        />
      </Stack>

      {error && !searchActive ? (
        <Alert severity="error" role="alert" sx={{ mb: 2 }}>
          {error}
          {requestIdText(searchState.requestId)}
        </Alert>
      ) : null}

      <DataTable<DoctorListItem>
        columns={[
          {
            key: 'lastName',
            header: 'Врач',
            render: (doctor) => (
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <MpAvatar
                  size="sm"
                  name={`${doctor.lastName} ${doctor.firstName}`}
                  {...(doctor.photoUrl ? { src: doctor.photoUrl } : {})}
                />
                <span>{`${doctor.lastName} ${doctor.firstName}`}</span>
              </Stack>
            ),
          },
          { key: 'specializationName', header: 'Специализация' },
          {
            key: 'status',
            header: 'Статус',
            render: (doctor) => (
              <StatusBadge
                label={doctor.status}
                tone={doctor.status === 'ACTIVE' ? 'success' : 'neutral'}
              />
            ),
          },
          {
            key: 'actions',
            header: '',
            render: (doctor) => (
              <LinkButton href={`/admin/doctors/${doctor.id}`} size="small" variant="text">
                Редактировать
              </LinkButton>
            ),
          },
        ]}
        rows={view.items}
        rowKey={(doctor) => doctor.id}
        loading={searchState.loading}
        {...(error && !searchActive ? { error } : {})}
        emptyTitle={filtered ? 'Ничего не найдено' : 'Врачей пока нет'}
        emptyDescription={
          filtered
            ? 'Измените запрос поиска или фильтры'
            : 'Создайте первого врача, чтобы он появился в записи на приём'
        }
        emptyActionLabel={filtered ? undefined : 'Создать врача'}
        emptyActionHref={filtered ? undefined : '/admin/doctors/new'}
      />

      {view.total > 0 ? (
        <PaginationBar
          meta={{ ...pagination, total: view.total }}
          onPageChange={(page) => pagination.setPage(page)}
        />
      ) : null}
    </Box>
  );
}

/** requestId в подписи ошибки (2.3/2.4: поддержка ищет его в ответе). */
function requestIdText(requestId?: string): string {
  return requestId ? ` (requestId: ${requestId})` : '';
}
