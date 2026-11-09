import { Box, TableFooter, Typography } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { MpButton } from '../Button/MpButton';
import { MpSkeleton } from '../Skeleton/MpSkeleton';
import { MpStatusBadge } from '../StatusBadge/MpStatusBadge';
import { MpTablePagination } from './MpTablePagination';
import {
  MpTable,
  MpTableBody,
  MpTableCell,
  MpTableContainer,
  MpTableHead,
  MpTableRow,
} from './MpTable';

interface Row {
  id: number;
  patient: string;
  doctor: string;
  specialization: string;
  time: string;
  status: 'SUBMITTED' | 'APPROVED' | 'DECLINED' | 'CANCELLED';
}

const rows: Row[] = [
  {
    id: 1041,
    patient: 'Иванов И. И.',
    doctor: 'Иванова М. С.',
    specialization: 'Хирург',
    time: '01.11.2026 09:30',
    status: 'APPROVED',
  },
  {
    id: 1042,
    patient: 'Кузнецова А. П.',
    doctor: 'Петров А. В.',
    specialization: 'Терапевт',
    time: '01.11.2026 10:15',
    status: 'SUBMITTED',
  },
  {
    id: 1043,
    patient: 'Смирнов Д. О.',
    doctor: 'Сидорова Е. А.',
    specialization: 'Педиатр',
    time: '01.11.2026 11:00',
    status: 'DECLINED',
  },
  {
    id: 1044,
    patient: 'Попова Н. В.',
    doctor: 'Иванова М. С.',
    specialization: 'Хирург',
    time: '02.11.2026 08:45',
    status: 'CANCELLED',
  },
  {
    id: 1045,
    patient: 'Волков С. С.',
    doctor: 'Кузнецов Д. И.',
    specialization: 'Кардиолог',
    time: '02.11.2026 12:30',
    status: 'SUBMITTED',
  },
];

const meta = {
  title: 'Components/Table',
  component: MpTable,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  argTypes: {
    children: { control: false },
    sx: { control: false },
  },
} satisfies Meta<typeof MpTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Управляемая пагинация: страница и шаг — через историю.
 * Колонки ID и «Специализация» — `hideBelow="lg"` (скрыты на 960–1279, макеты).
 */
function AppointmentsTable({ rowCount = 42 }: { rowCount?: number }) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  return (
    <MpTableContainer
      sx={{ maxWidth: 960, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
    >
      <MpTable aria-label="Управление записями">
        <MpTableHead>
          <MpTableRow>
            <MpTableCell head hideBelow="lg">
              ID
            </MpTableCell>
            <MpTableCell head>Пациент</MpTableCell>
            <MpTableCell head>Врач</MpTableCell>
            <MpTableCell head hideBelow="lg">
              Специализация
            </MpTableCell>
            <MpTableCell head>Время приёма</MpTableCell>
            <MpTableCell head>Статус</MpTableCell>
            <MpTableCell head align="right">
              Действия
            </MpTableCell>
          </MpTableRow>
        </MpTableHead>
        <MpTableBody>
          {rows.map((row) => (
            <MpTableRow key={row.id} hover>
              <MpTableCell hideBelow="lg">ap-{row.id}</MpTableCell>
              <MpTableCell>{row.patient}</MpTableCell>
              <MpTableCell>{row.doctor}</MpTableCell>
              <MpTableCell hideBelow="lg">{row.specialization}</MpTableCell>
              <MpTableCell>
                <Typography variant="mono">{row.time}</Typography>
              </MpTableCell>
              <MpTableCell>
                <MpStatusBadge status={row.status} />
              </MpTableCell>
              <MpTableCell align="right">
                <MpButton size="small" variant="outlined">
                  Принять
                </MpButton>
              </MpTableCell>
            </MpTableRow>
          ))}
        </MpTableBody>
        <TableFooter>
          <MpTableRow>
            <MpTablePagination
              count={rowCount}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={(_, next) => setPage(next)}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(Number(event.target.value));
                setPage(0);
              }}
              colSpan={7}
            />
          </MpTableRow>
        </TableFooter>
      </MpTable>
    </MpTableContainer>
  );
}

export const Playground: Story = {
  render: () => <AppointmentsTable />,
};

export const Empty: Story = {
  render: () => (
    <MpTableContainer
      sx={{ maxWidth: 640, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
    >
      <MpTable aria-label="Пустая таблица">
        <MpTableHead>
          <MpTableRow>
            <MpTableCell head>ID</MpTableCell>
            <MpTableCell head>Пациент</MpTableCell>
            <MpTableCell head>Статус</MpTableCell>
          </MpTableRow>
        </MpTableHead>
        <MpTableBody>
          <MpTableRow>
            <MpTableCell colSpan={3} align="center" sx={{ color: 'text.secondary', py: 4 }}>
              Нет данных по заданным фильтрам
            </MpTableCell>
          </MpTableRow>
        </MpTableBody>
      </MpTable>
    </MpTableContainer>
  ),
};

export const Loading: Story = {
  render: () => (
    <MpTableContainer
      sx={{ maxWidth: 640, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
    >
      {/* Макеты: loading — скелетон 10 строк таблицы вместо спиннера-центра. */}
      <MpSkeleton rows={10} height={44} />
    </MpTableContainer>
  ),
};

export const PaginationOnly: Story = {
  render: () => (
    <Box sx={{ maxWidth: 720 }}>
      <MpTablePagination
        count={128}
        page={2}
        rowsPerPage={25}
        onPageChange={() => undefined}
        onRowsPerPageChange={() => undefined}
      />
    </Box>
  ),
};
