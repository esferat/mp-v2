import TablePagination, { type TablePaginationProps } from '@mui/material/TablePagination';
import { forwardRef } from 'react';

export type MpTablePaginationProps = Omit<TablePaginationProps, 'labelDisplayedRows'> & {
  /** Русские подписи по умолчанию; можно переопределить. */
  labelDisplayedRows?: TablePaginationProps['labelDisplayedRows'];
};

/**
 * Пагинация таблицы: подписи и шаги по умолчанию — из коробки (10 строк, как в макетах).
 *
 * Важно: размещайте прямо в `MpTableRow` (без обёртки в `MpTableCell`) —
 * `TablePagination` сам рендерит ячейку, вложенная `<td>` невалидна.
 *
 * @example
 * <MpTableFooter>
 *   <MpTableRow>
 *     <MpTablePagination count={42} page={0} rowsPerPage={10} onPageChange={...} colSpan={6} />
 *   </MpTableRow>
 * </MpTableFooter>
 */
export const MpTablePagination = forwardRef<HTMLDivElement, MpTablePaginationProps>(
  function MpTablePagination(
    {
      rowsPerPageOptions = [10, 25, 50],
      labelRowsPerPage = 'На странице:',
      labelDisplayedRows = ({ from, to, count }) =>
        count === 0 ? 'Нет записей' : `${from}–${to} из ${count}`,
      showFirstButton = true,
      showLastButton = true,
      ...props
    },
    ref,
  ) {
    return (
      <TablePagination
        ref={ref}
        rowsPerPageOptions={rowsPerPageOptions}
        labelRowsPerPage={labelRowsPerPage}
        labelDisplayedRows={labelDisplayedRows}
        showFirstButton={showFirstButton}
        showLastButton={showLastButton}
        {...props}
      />
    );
  },
);
