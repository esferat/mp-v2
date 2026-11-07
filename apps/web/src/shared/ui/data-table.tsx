'use client';

import type { ReactNode } from 'react';
import {
  Box,
  CircularProgress,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { EmptyState } from './empty-state';

export interface TableColumn<Row> {
  key: string;
  header: string;
  /** Ячейка строки; по умолчанию — значение поля по key. */
  render?: (row: Row) => ReactNode;
  /** Выравнивание и «ширина» колонки. */
  align?: 'left' | 'right' | 'center';
  width?: number | string;
}

export interface DataTableProps<Row> {
  columns: ReadonlyArray<TableColumn<Row>>;
  rows: ReadonlyArray<Row>;
  rowKey: (row: Row) => string;
  /** Состояние загрузки: скелетон вместо пустоты (2.2/2.4). */
  loading?: boolean;
  /** Ошибка загрузки: сообщение вместо таблицы. */
  error?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Действие в пустом состоянии (например, «Создать врача»). */
  emptyActionLabel?: string;
  emptyActionHref?: string;
}

/**
 * Таблица с состояниями loading/empty/error (2.2: скелетоны и empty-state
 * по design/README.md). Пагинация подключается снаружи (2.5, usePagination).
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  emptyTitle = 'Нет данных',
  emptyDescription,
  emptyActionLabel,
  emptyActionHref,
}: DataTableProps<Row>): React.JSX.Element {
  if (error) {
    return (
      <Box role="alert" sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box aria-busy="true" data-testid="table-loading">
        {columns.map((column) => (
          <Skeleton key={column.key} height={48} />
        ))}
      </Box>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        actionHref={emptyActionHref}
      />
    );
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell
                key={column.key}
                align={column.align ?? 'left'}
                width={column.width}
                sx={{ fontWeight: 700 }}
              >
                {column.header}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={rowKey(row)} hover>
              {columns.map((column) => (
                <TableCell key={column.key} align={column.align ?? 'left'}>
                  {column.render
                    ? column.render(row)
                    : String((row as Record<string, unknown>)[column.key] ?? '')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** Спиннер для локальных операций (aria-label обязателен — доступность). */
export function Spinner({ label }: { label: string }): React.JSX.Element {
  return <CircularProgress aria-label={label} size={24} />;
}
