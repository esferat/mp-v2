'use client';

import { TablePagination, type TablePaginationProps } from '@mui/material';
import type { PaginationMeta } from '../lib';

/**
 * Пагинация таблицы (задача 2.5): интеграция usePagination ↔ DataTable.
 * Недоступные кнопки — из меты (previousDisabled/nextDisabled).
 */
export function PaginationBar({
  meta,
  onPageChange,
  labelRowsPerPage = 'На странице',
  labelDisplayedRows,
}: {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  labelRowsPerPage?: string;
  labelDisplayedRows?: TablePaginationProps['labelDisplayedRows'];
}): React.JSX.Element {
  const { page, limit, total, previousDisabled, nextDisabled } = meta;
  const count = total > 0 ? total : -1;

  return (
    <TablePagination
      component="div"
      count={count}
      page={page}
      onPageChange={(_event, nextPage) => onPageChange(nextPage)}
      rowsPerPage={limit}
      onRowsPerPageChange={() => undefined}
      slotProps={{
        actions: {
          previousButton: { disabled: previousDisabled },
          nextButton: { disabled: nextDisabled },
        },
      }}
      labelRowsPerPage={labelRowsPerPage}
      {...(labelDisplayedRows ? { labelDisplayedRows } : {})}
    />
  );
}
