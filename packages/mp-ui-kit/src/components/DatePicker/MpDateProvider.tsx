import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import type { Locale } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { ReactNode } from 'react';

export interface MpDateProviderProps {
  children: ReactNode;
  /** Локаль date-fns (форматы дат). @default ru */
  locale?: Locale;
}

/**
 * Провайдер локали для всех `MpDatePicker` / `MpDateRangePicker`.
 * Один адаптер на проект — date-fns (functional-spec §2.2).
 *
 * @example
 * <MpDateProvider>
 *   <App />
 * </MpDateProvider>
 */
export function MpDateProvider({ children, locale = ru }: MpDateProviderProps) {
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={locale}>
      {children}
    </LocalizationProvider>
  );
}
