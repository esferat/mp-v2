'use client';

import { useState } from 'react';
import type { PatientListResponse } from '@mp/contracts';
import { Alert, Box, DataTable, MpTextField, MpAvatar, PaginationBar } from '@/shared/ui';
import { fetchPatientsPage, usePatientsSearch } from '@/features/search-patients';
import { usePagination } from '@/shared/lib';
import { toApiError } from '@/shared/api/errors';

/**
 * Таблица пациентов (4.1: widgets/patients-table): SSR-данные как стартовое
 * состояние, поиск по ФИО/email — debounce в BFF без перезагрузки (AC),
 * пагинация — хук 2.5 (номер страницы в URL).
 */
export function PatientsTable({ initial }: { initial: PatientListResponse }): React.JSX.Element {
  const [pageData, setPageData] = useState<PatientListResponse>(initial);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const searchState = usePatientsSearch({ offset: 0, limit: 10 });
  const pagination = usePagination({ limit: 10, total: pageData.total });

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
      const response = await fetchPatientsPage({
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
        <MpTextField
          label="Поиск по ФИО или email"
          name="patient-search"
          size="small"
          value={searchState.search}
          onChange={(event) => searchState.setSearch(event.target.value)}
          placeholder="Фамилия, имя или почта"
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

      <DataTable<PatientListResponse['items'][number]>
        columns={[
          {
            key: 'photoUrl',
            header: '',
            render: (patient) => (
              <MpAvatar
                size="sm"
                name={`${patient.lastName} ${patient.firstName}`}
                {...(patient.photoUrl ? { src: patient.photoUrl } : {})}
              />
            ),
          },
          {
            key: 'lastName',
            header: 'Пациент',
            render: (patient) => `${patient.lastName} ${patient.firstName}`,
          },
          { key: 'email', header: 'Email' },
          { key: 'birthDate', header: 'Дата рождения' },
          { key: 'registrationDate', header: 'Регистрация' },
        ]}
        rows={view.items}
        rowKey={(patient) => patient.id}
        loading={loading}
        {...(error ? { error } : {})}
        emptyTitle={searchActive ? 'Ничего не найдено' : 'Пациентов пока нет'}
        emptyDescription={
          searchActive ? 'Измените запрос поиска' : 'Пациенты появятся после регистрации'
        }
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
