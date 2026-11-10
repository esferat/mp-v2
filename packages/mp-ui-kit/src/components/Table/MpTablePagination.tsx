import TablePagination, { type TablePaginationProps } from '@mui/material/TablePagination';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { createContext, forwardRef, type ReactNode, useContext } from 'react';
import { mpTokens } from '../../theme/tokens';

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

/** Подпись страницы по макетам: «Страница X из Y» (0 — «Нет записей», -1 — без total). */
function pageLabel(count: number, page: number, rowsPerPage: number): string {
  if (count === 0) return 'Нет записей';
  if (count === -1) return `Страница ${page + 1}`;
  const totalPages = rowsPerPage > 0 ? Math.max(1, Math.ceil(count / rowsPerPage)) : 1;
  return `Страница ${page + 1} из ${totalPages}`;
}

/**
 * Props кастомных действий пагинации (MUI передаёт их в `ActionsComponent`;
 * тип `TablePaginationActionsProps` не реэкспортируется из @mui/material).
 */
interface MpPaginationActionsProps {
  /** Класс MUI (`.MuiTablePagination-actions`) — нужен для flex-порядка в тулбаре. */
  className?: string;
  count: number;
  page: number;
  rowsPerPage: number;
  disabled?: boolean;
  getItemAriaLabel: (type: 'first' | 'last' | 'next' | 'previous') => string;
  onPageChange: (event: React.MouseEvent<HTMLButtonElement> | null, page: number) => void;
  /** slotProps.actions вызывающего (PaginationBar: previousDisabled/nextDisabled). */
  slotProps?: {
    previousButton?: { disabled?: boolean };
    nextButton?: { disabled?: boolean };
  };
}

/**
 * Кнопки ‹ › вокруг подписи «Страница X из Y» (visual/_shared.css `.pagination`:
 * `<span>Всего</span> ‹ Страница 1 из 13 › <select>` — контейнер `.pages`,
 * кнопки — `.btn-neutral btn-sm`: высота 24, padding 0 8, радиус 8, 12px/600).
 */
function PaginationActions({
  className,
  count,
  page,
  rowsPerPage,
  disabled,
  onPageChange,
  getItemAriaLabel,
  slotProps,
}: MpPaginationActionsProps) {
  // disabled от вызывающего (PaginationBar: previousDisabled/nextDisabled) — приоритет
  const backDisabled = slotProps?.previousButton?.disabled ?? (disabled || page === 0);
  const nextDisabled =
    slotProps?.nextButton?.disabled ??
    (disabled || (count !== -1 && page >= Math.ceil(count / rowsPerPage) - 1));

  const buttonSx = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
    minWidth: 24,
    px: 1, // padding: 0 8px (.btn-sm)
    border: '1px solid',
    borderColor: mpTokens.neutral[300],
    borderRadius: '8px', // r-md (.btn)
    color: mpTokens.neutral[700],
    backgroundColor: 'background.paper',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1,
    cursor: 'pointer',
    '&:hover': { backgroundColor: mpTokens.neutral[50] },
    '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
  } as const;

  return (
    // className MUI (`.MuiTablePagination-actions`) — иначе flex-порядок в тулбаре не работает
    <Box className={className} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box
        component="button"
        type="button"
        aria-label={getItemAriaLabel('previous')}
        disabled={backDisabled}
        onClick={(event) => onPageChange(event, page - 1)}
        sx={buttonSx}
      >
        ‹
      </Box>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ whiteSpace: 'nowrap', fontSize: 13 }}
      >
        {pageLabel(count, page, rowsPerPage)}
      </Typography>
      <Box
        component="button"
        type="button"
        aria-label={getItemAriaLabel('next')}
        disabled={nextDisabled}
        onClick={(event) => onPageChange(event, page + 1)}
        sx={buttonSx}
      >
        ›
      </Box>
    </Box>
  );
}

/**
 * Подвал пагинации по макетам (visual/_shared.css `.pagination`): слева
 * «Всего: N», по центру ‹ Страница X из Y ›, справа «На странице: [10 ▾]» —
 * селект оформляется как чип-пилюля (`.chip`: высота 24, радиус 12,
 * фон neutral-100, 12px/600 neutral-700).
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
      component,
      sx,
      ...props
    },
    ref,
  ) {
    /**
     * MUI задаёт корню `display: table-cell` (для `<tfoot>`). Вне таблицы
     * (`component="div"` — подвал карточки) такой элемент сжимается по
     * содержимому вместо растяжки на всю ширину — явно делаем block.
     */
    const standalone = component === 'div';
    const rootSx = standalone
      ? [{ display: 'block', width: '100%' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]
      : sx;

    const displayedRows: TablePaginationProps['labelDisplayedRows'] =
      labelDisplayedRows ??
      (count === 0
        ? () => 'Нет записей'
        : ({ page: current }) => pageLabel(count, current, rowsPerPage));

    const totalNode = showTotal ? (
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ order: 0, whiteSpace: 'nowrap', fontSize: 13 }}
      >
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
          {...(component !== undefined ? { component } : {})}
          sx={rootSx}
          // Кнопки ‹ › обрамляют подпись страницы — подпись MUI (displayed-rows) прячется
          slots={{ ...slots, toolbar: PaginationToolbar }}
          ActionsComponent={PaginationActions}
          {...props}
        />
      </PaginationTotalContext.Provider>
    );
  },
);

/** Тулбар пагинации: «Всего» · ‹ Страница X из Y › · «На странице: [10 ▾]». */
function PaginationToolbar({ children, className }: { children?: ReactNode; className?: string }) {
  const total = useContext(PaginationTotalContext);

  return (
    <Toolbar
      className={className}
      // Инлайн, а не sx: глобальный override темы MuiToolbar (minHeight 64 —
      // для шапки) в MUI v9 побеждает sx-класс и давал вертикальный скролл
      // внутри бокса пагинации (root: minHeight 40, overflow: auto).
      style={{ minHeight: 40 }}
      sx={{
        py: 1,
        px: 1,
        columnGap: 0,
        rowGap: 0.5,
        // На узких ширинах блоки переносятся, а не переполняют бокс
        // (внутри бокса появлялся скролл — root имеет overflow: auto).
        flexWrap: 'wrap',
        alignItems: 'center',
        color: 'text.secondary',
        fontSize: 13,
        // space-between как в `.pagination` макета: ‹ страница › центрируется
        // в свободной зоне (flex:1), правая группа прижата вправо
        '& .MuiTablePagination-spacer': { display: 'none' },
        '& .MuiTablePagination-actions': {
          order: 1,
          marginLeft: 0,
          flex: '1 1 auto',
          justifyContent: 'center',
        },
        // Подпись теперь внутри actions (‹ текст ›) — дефолтную прячем
        '& .MuiTablePagination-displayedRows': { display: 'none' },
        '& .MuiTablePagination-selectLabel': {
          order: 3,
          margin: 0,
          mr: 0.5,
          whiteSpace: 'nowrap',
          fontSize: 13,
        },
        // Селект «10 ▾» — чип-пилюля (`.chip` макета). MUI Select НЕ вешает
        // класс selectRoot (в DOM только select+input на корне) — целимся в
        // прямого потомка тулбара, чтобы исключить вложенный .MuiSelect-select.
        '& > .MuiTablePagination-select': {
          order: 4,
          position: 'relative',
          marginLeft: 0,
          marginRight: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          height: 24,
          pl: 1,
          pr: 1,
          borderRadius: '12px',
          backgroundColor: mpTokens.neutral[100],
          '&:focus-within': { borderRadius: '12px', backgroundColor: mpTokens.neutral[100] },
          // Отображаемое значение («10»)
          '& .MuiSelect-select': {
            margin: 0,
            padding: 0,
            minHeight: 0,
            minWidth: 0,
            fontSize: 12,
            fontWeight: 600,
            color: mpTokens.neutral[700],
            textAlign: 'left',
            textAlignLast: 'left',
            '&:focus': { backgroundColor: 'transparent', borderRadius: '12px' },
          },
          // Стрелка ▾ — статично в потоке, серая (`.field .select::after`)
          '& .MuiTablePagination-selectIcon': {
            position: 'static',
            transform: 'none',
            color: mpTokens.neutral[400],
            width: 14,
            height: 14,
            fontSize: 14,
          },
        },
      }}
    >
      {total}
      {children}
    </Toolbar>
  );
}
