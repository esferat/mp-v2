'use client';

import { useState } from 'react';
import type { DoctorListItem, DoctorListResponse } from '@mp/contracts';
import {
  Alert,
  Box,
  DataTable,
  FormField,
  LinkButton,
  MpAvatar,
  PaginationBar,
  Stack,
  StatusBadge,
} from '@/shared/ui';
import { useDoctorsSearch, fetchDoctorsPage } from '@/features/search-doctors';
import { usePagination } from '@/shared/lib';
import { toApiError } from '@/shared/api/errors';

/**
 * Таблица врачей (3.1: widgets/doctors-table): SSR-данные как стартовое
 * состояние, поиск — debounce в BFF без перезагрузки (AC), пагинация —
 * хук 2.5 (номер страницы в URL, восстановление после F5).
 */
export function DoctorsTable({ initial }: { initial: DoctorListResponse }): React.JSX.Element {
  const [pageData, setPageData] = useState<DoctorListResponse>(initial);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const searchState = useDoctorsSearch({ offset: 0, limit: 10 });
  const pagination = usePagination({ limit: 10, total: pageData.total });

  // Поиск активен → данные из поискового хука; иначе — данные страницы (SSR/пагинация)
  const searchActive = searchState.search.trim().length > 0;
  const view = searchActive && searchState.result ? searchState.result : pageData;
  const loading = searchActive ? searchState.loading : pageLoading;
  const error = searchActive ? searchState.error : pageError;
  const requestId = searchActive ? searchState.requestId : undefined;

  async function changePage(nextPage: number): Promise<void> {
    pagination.setPage(nextPage);
    setPageLoading(true);
    setPageError(null);
    try {
      const response = await fetchDoctorsPage({
        ...(searchActive ? { search: searchState.search.trim() } : {}),
        offset: nextPage * pagination.limit,
        limit: pagination.limit,
      });
      setPageData(response);
    } catch (caught) {
      setPageError(toApiError(caught).message);
    } finally {
      setPageLoading(false);
    }
  }

  return (
    <Box>
      <Box sx={{ mb: 2, maxWidth: 420 }}>
        <FormField
          label="Поиск по ФИО"
          name="doctor-search"
          value={searchState.search}
          onChange={searchState.setSearch}
          placeholder="Фамилия, имя или отчество"
          error={searchState.error !== null && searchActive}
          {...(searchActive && searchState.error
            ? { helperText: `${searchState.error}${requestId ? ` (requestId: ${requestId})` : ''}` }
            : {})}
        />
      </Box>

      {pageError && !searchActive ? (
        <Alert severity="error" role="alert" sx={{ mb: 2 }}>
          {pageError}
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
        loading={loading}
        {...(error && !searchActive ? { error } : {})}
        emptyTitle={searchActive ? 'Ничего не найдено' : 'Врачей пока нет'}
        emptyDescription={
          searchActive
            ? 'Измените запрос поиска'
            : 'Создайте первого врача, чтобы он появился в записи на приём'
        }
        emptyActionLabel={searchActive ? undefined : 'Создать врача'}
        emptyActionHref={searchActive ? undefined : '/admin/doctors/new'}
      />

      {view.total > 0 ? (
        <PaginationBar
          meta={{ ...pagination, total: view.total }}
          onPageChange={(page) => {
            void changePage(page);
          }}
        />
      ) : null}
    </Box>
  );
}
