'use client';

import { MpTablePagination } from 'mp-ui-kit';
import type { PaginationMeta } from '../lib';

/**
 * Пагинация таблицы (задача 2.5): подвал по макетам — «Всего: N» слева,
 * «Страница X из Y», «На странице: 10 ▾» (10/25/50) — MpTablePagination.
 * Недоступные кнопки — из меты (previousDisabled/nextDisabled).
 * Смена размера страницы — опциональна (onLimitChange через usePagination.setLimit).
 */
export function PaginationBar({
  meta,
  onPageChange,
  onLimitChange,
}: {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  /** Смена размера страницы; без обработчика селектор скрыт (шаги 10/25/50). */
  onLimitChange?: (limit: number) => void;
}): React.JSX.Element {
  const { page, limit, total, previousDisabled, nextDisabled } = meta;
  const count = total > 0 ? total : -1;

  return (
    <MpTablePagination
      component="div"
      count={count}
      page={page}
      onPageChange={(_event, nextPage) => onPageChange(nextPage)}
      rowsPerPage={limit}
      {...(onLimitChange
        ? {
            rowsPerPageOptions: [10, 25, 50],
            onRowsPerPageChange: (event) => onLimitChange(Number(event.target.value)),
          }
        : { rowsPerPageOptions: [] })}
      slotProps={{
        actions: {
          previousButton: { disabled: previousDisabled },
          nextButton: { disabled: nextDisabled },
        },
      }}
    />
  );
}
