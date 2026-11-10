'use client';

import type { ReactNode } from 'react';
import {
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { MpSkeleton } from 'mp-ui-kit';
import { EmptyState } from './empty-state';

export interface TableColumn<Row> {
  key: string;
  header: string;
  /** Ячейка строки; по умолчанию — значение поля по key. */
  render?: (row: Row) => ReactNode;
  /** Выравнивание и «ширина» колонки. */
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  /**
   * Моноширинная ячейка — время приёма, идентификаторы
   * (макеты: `Typography mono`, visual/_shared.css `.time`).
   */
  mono?: boolean;
  /** Скрыть колонку ниже брейкпоинта (макеты: ID — только ≥ 960). */
  hideBelow?: 'sm' | 'md' | 'lg';
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
  /**
   * Подвал внутри карточки — пагинация (макет appointments.html:
   * `<section class="card">` → таблица → `.pagination`).
   */
  footer?: ReactNode;
  /**
   * Размер страницы (rows per page): тело добивается пустыми строками до
   * выбранного количества, даже если данных меньше (единая сетка строк).
   */
  pageSize?: number;
}

/**
 * Таблица в белой карточке с состояниями loading/empty/error (2.2: скелетоны
 * и empty-state по design/README.md). Пагинация (2.5, usePagination)
 * передаётся в `footer` — она рендерится в той же карточке, что и таблица
 * (visual/_shared.css `.card` + `.pagination`). Колонки — из mp-ui-kit
 * (MpTable*): `mono`-ячейки, `hideBelow` для второстепенных колонок.
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
  footer,
  pageSize,
}: DataTableProps<Row>): React.JSX.Element {
  // Карточка таблицы (`.card`: белый фон, рамка neutral-200, радиус 12, без внутренних полей)
  const cardSx = {
    bgcolor: 'background.paper',
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: '12px',
    overflow: 'hidden',
  } as const;

  if (error) {
    return (
      <Box role="alert" sx={{ ...cardSx, p: 3, textAlign: 'center' }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box aria-busy="true" data-testid="table-loading" sx={cardSx}>
        {columns.map((column) => (
          <MpSkeleton key={column.key} height={48} />
        ))}
      </Box>
    );
  }

  if (rows.length === 0) {
    return (
      <Box sx={cardSx}>
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={emptyActionLabel}
          actionHref={emptyActionHref}
        />
      </Box>
    );
  }

  // Добивка пустыми строками до выбранного размера страницы: тело таблицы
  // всегда заполнено на rowsPerPage, даже на последней странице (pageSize)
  const placeholderCount = pageSize !== undefined ? Math.max(0, pageSize - rows.length) : 0;

  return (
    <Box sx={cardSx}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  align={column.align ?? 'left'}
                  width={column.width}
                  sx={{
                    fontWeight: 700,
                    ...(column.hideBelow ? hideBelowSx(column.hideBelow) : {}),
                  }}
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
                  <TableCell
                    key={column.key}
                    align={column.align ?? 'left'}
                    sx={column.hideBelow ? hideBelowSx(column.hideBelow) : undefined}
                  >
                    {column.mono ? (
                      <Typography variant="mono" component="span">
                        {column.render
                          ? column.render(row)
                          : String((row as Record<string, unknown>)[column.key] ?? '')}
                      </Typography>
                    ) : column.render ? (
                      column.render(row)
                    ) : (
                      String((row as Record<string, unknown>)[column.key] ?? '')
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {/* Пустые строки добиваются до pageSize (aria-hidden: декоративные) */}
            {Array.from({ length: placeholderCount }, (_, index) => (
              <TableRow key={`placeholder-${index}`} aria-hidden="true">
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    align={column.align ?? 'left'}
                    // Высота строки таблицы (реальные строки 40–41px)
                    height={40}
                    sx={column.hideBelow ? hideBelowSx(column.hideBelow) : undefined}
                  />
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {footer}
    </Box>
  );
}

/** Скрытие колонки ниже брейкпоинта (MpTableCell.hideBelow — те же макеты). */
function hideBelowSx(breakpoint: NonNullable<TableColumn<unknown>['hideBelow']>) {
  return { display: { xs: 'none', [breakpoint]: 'table-cell' } as const };
}

/** Спиннер для локальных операций (aria-label обязателен — доступность). */
export function Spinner({ label }: { label: string }): React.JSX.Element {
  return <CircularProgress aria-label={label} size={24} />;
}
