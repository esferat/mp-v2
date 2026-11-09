import Table, { type TableProps } from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell, { type TableCellProps } from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableFooter from '@mui/material/TableFooter';
import TableHead from '@mui/material/TableHead';
import TableRow, { type TableRowProps } from '@mui/material/TableRow';
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';

export type { TableProps, TableCellProps, TableRowProps };

/** Таблица mp-ui-kit (компактные отступы ячеек задаются темой). */
export const MpTable = forwardRef<HTMLTableElement, TableProps>(function MpTable(props, ref) {
  return <Table ref={ref} {...props} />;
});

/** Обёртка для горизонтальной прокрутки таблицы. */
export const MpTableContainer = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof TableContainer>
>(function MpTableContainer(props, ref) {
  return <TableContainer ref={ref} {...props} />;
});

export const MpTableHead = forwardRef<
  HTMLTableSectionElement,
  ComponentPropsWithoutRef<typeof TableHead>
>(function MpTableHead(props, ref) {
  return <TableHead ref={ref} {...props} />;
});

export const MpTableRow = forwardRef<HTMLTableRowElement, TableRowProps>(
  function MpTableRow(props, ref) {
    return <TableRow ref={ref} {...props} />;
  },
);

export const MpTableBody = forwardRef<
  HTMLTableSectionElement,
  ComponentPropsWithoutRef<typeof TableBody>
>(function MpTableBody(props, ref) {
  return <TableBody ref={ref} {...props} />;
});

export const MpTableFooter = forwardRef<
  HTMLTableSectionElement,
  ComponentPropsWithoutRef<typeof TableFooter>
>(function MpTableFooter(props, ref) {
  return <TableFooter ref={ref} {...props} />;
});

/** Брейкпоинт темы (по макетам: `md` = 960, `lg` = 1280). */
export type MpBreakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface MpTableCellProps extends Omit<TableCellProps, 'children'> {
  /** Заголовок колонки: рендерит `<th scope="col">`. */
  head?: boolean;
  /**
   * Скрыть колонку на брейкпоинтах меньше указанного (макеты:
   * «960–1279 — колонки ID и Фото скрыты» → `hideBelow="lg"`).
   */
  hideBelow?: MpBreakpoint;
  children?: ReactNode;
}

/**
 * Ячейка таблицы: с `head` — `<th>`, иначе `<td>`.
 *
 * @example
 * <MpTableCell head>Пациент</MpTableCell>
 * <MpTableCell hideBelow="lg">64de63…</MpTableCell>
 */
export const MpTableCell = forwardRef<HTMLTableCellElement, MpTableCellProps>(function MpTableCell(
  { head, component, scope, hideBelow, sx, ...props },
  ref,
) {
  const responsiveSx = hideBelow ? [{ display: { xs: 'none', [hideBelow]: 'table-cell' } }] : [];
  const mergedSx = [...responsiveSx, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])];

  if (head) {
    return (
      <TableCell
        ref={ref}
        component={component ?? 'th'}
        scope={scope ?? 'col'}
        sx={mergedSx}
        {...props}
      />
    );
  }
  return <TableCell ref={ref} component={component} scope={scope} sx={mergedSx} {...props} />;
});
