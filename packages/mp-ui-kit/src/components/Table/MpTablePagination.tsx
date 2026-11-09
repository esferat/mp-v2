import TablePagination, { type TablePaginationProps } from '@mui/material/TablePagination';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { createContext, forwardRef, useContext, type ReactNode } from 'react';

export type MpTablePaginationProps = Omit<TablePaginationProps, 'labelDisplayedRows'> & {
  /** Русские подписи по умолчанию; можно переопределить. */
  labelDisplayedRows?: TablePaginationProps['labelDisplayedRows'];
  /** Показывать «Всего: N» слева (макеты: «Всего: 42»). @default true */
  showTotal?: boolean;
  /** Подпись общего количества. @default `Всего: N` */
  totalLabel?: (count: number) => ReactNode;
};

/** «Всего: N» для тулбара пагинации (передаётся контекстом, без slotProps). */
const PaginationTotalContext = createContext<ReactNode>(null);

/**
 * Подвал пагинации по макетам: слева «Всего: N», по центру ‹ Страница X из Y ›,
 * справа «На странице: [10 ▾]» (10/25/50, шаг вперёд/назад — на страницу).
 *
 * Порядок блоков собирается flex-`order` поверх тулбара MUI (по классам подкомпонентов).
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
      rowsPerPage = 10,
      count,
      page,
      labelRowsPerPage = 'На странице:',
      labelDisplayedRows,
      showTotal = true,
      totalLabel,
      showFirstButton = false,
      showLastButton = false,
      slots,
      ...props
    },
    ref,
  ) {
    const totalPages = rowsPerPage > 0 ? Math.max(1, Math.ceil(count / rowsPerPage)) : 1;
    const displayedRows: TablePaginationProps['labelDisplayedRows'] =
      labelDisplayedRows ??
      (count === 0
        ? () => 'Нет записей'
        : ({ page: current }) => `Страница ${current + 1} из ${totalPages}`);

    const totalNode = showTotal ? (
      <Typography variant="body2" color="text.secondary" sx={{ order: 0, whiteSpace: 'nowrap' }}>
        {totalLabel ? totalLabel(count) : `Всего: ${count === -1 ? '—' : count}`}
      </Typography>
    ) : null;

    return (
      <PaginationTotalContext.Provider value={totalNode}>
        <TablePagination
          ref={ref}
          rowsPerPageOptions={rowsPerPageOptions}
          rowsPerPage={rowsPerPage}
          count={count}
          page={page}
          labelRowsPerPage={labelRowsPerPage}
          labelDisplayedRows={displayedRows}
          showFirstButton={showFirstButton}
          showLastButton={showLastButton}
          slots={{ ...slots, toolbar: PaginationToolbar }}
          {...props}
        />
      </PaginationTotalContext.Provider>
    );
  },
);

/** Тулбар пагинации: «Всего» · ‹ Страница X из Y › · «На странице». */
function PaginationToolbar({ children, className }: { children?: ReactNode; className?: string }) {
  const total = useContext(PaginationTotalContext);

  return (
    <Toolbar
      className={className}
      sx={{
        minHeight: 44,
        px: 2,
        gap: 1.5,
        flexWrap: 'nowrap',
        // Порядок блоков по макету: всего → действия → «Страница X из Y» → [spacer] → строк на странице.
        '& .MuiTablePagination-spacer': { order: 3, flex: '1 1 auto' },
        '& .MuiTablePagination-actions': { order: 1, marginLeft: 0 },
        '& .MuiTablePagination-displayedRows': { order: 2, margin: 0, whiteSpace: 'nowrap' },
        '& .MuiTablePagination-selectLabel': { order: 4, margin: 0, whiteSpace: 'nowrap' },
        '& .MuiTablePagination-selectRoot': { order: 5, marginRight: 0 },
      }}
    >
      {total}
      {children}
    </Toolbar>
  );
}
