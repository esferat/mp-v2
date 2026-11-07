'use client';

import { useMemo, useState } from 'react';
import type { DoctorPatientList } from '@mp/contracts';
import { Box, DataTable, FormField, LinkButton, Typography } from '@/shared/ui';
import { formatRuDate } from '@/shared/lib';

/**
 * Пациенты врача (9.3, design/doctor-patients.md): distinct из записей
 * врача — doctorId сервер берёт из привязки sub. Поиск — клиентская
 * фильтрация по загруженному списку (список ограничен размером кабинета,
 * серверная пагинация не нужна: API отдаёт всех пациентов врача разом).
 */
export function DoctorPatientsTable({
  initial,
}: {
  initial: DoctorPatientList;
}): React.JSX.Element {
  const [search, setSearch] = useState('');

  const view = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return initial.items;
    return initial.items.filter((item) => item.patientName.toLowerCase().includes(query));
  }, [initial.items, search]);

  return (
    <Box>
      <Box sx={{ mb: 2, maxWidth: 420 }}>
        <FormField
          label="Поиск по ФИО"
          name="doctor-patient-search"
          value={search}
          onChange={setSearch}
          placeholder="Фамилия или имя"
        />
      </Box>

      <DataTable<DoctorPatientList['items'][number]>
        columns={[
          { key: 'patientName', header: 'Пациент' },
          {
            key: 'lastVisit',
            header: 'Последний приём',
            render: (item) => (item.lastVisit ? formatRuDate(item.lastVisit) : '—'),
          },
          {
            key: 'actions',
            header: '',
            render: (item) => (
              <LinkButton href={`/doctor/patients/${item.patientId}`} size="small" variant="text">
                Открыть
              </LinkButton>
            ),
          },
        ]}
        rows={view}
        rowKey={(item) => item.patientId}
        emptyTitle={search ? 'Ничего не найдено' : 'Пациентов пока нет'}
        emptyDescription={
          search
            ? 'Измените запрос поиска'
            : 'Пациенты появятся после ваших приёмов (APPROVED/COMPLETED)'
        }
      />

      <Box sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {`Всего: ${view.length}${search ? ` из ${initial.total}` : ''}`}
        </Typography>
      </Box>
    </Box>
  );
}
