'use client';

import type { ReactNode } from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { ru } from 'date-fns/locale';

/**
 * Даты (2.2): один адаптер (date-fns) на весь проект, русская локализация.
 * Провайдер подключается в UiProviders — страницы используют поля напрямую.
 */
export function DatePickersProvider({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
      {children}
    </LocalizationProvider>
  );
}

/** Поле даты (2.2): лейбл, ошибка, кнопка-календарь — из MUI X (community). */
export function DateField({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  error,
  disabled,
}: {
  label: string;
  /** null — пусто. */
  value: Date | null;
  onChange: (value: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  error?: boolean;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <DatePicker
      label={label}
      value={value}
      onChange={onChange}
      minDate={minDate}
      maxDate={maxDate}
      disabled={disabled}
      slotProps={{
        textField: { error, fullWidth: true, size: 'small' },
      }}
    />
  );
}

/**
 * Диапазон дат (2.2): два DatePicker подряд — решение по MUI X Pro
 * (single DatePicker с `responses`/Pro-диапазоном) фиксируется в отчёте до 7.2.
 */
export function DateRangeField({
  labelFrom = 'С',
  labelTo = 'По',
  from,
  to,
  onFromChange,
  onToChange,
  error,
}: {
  labelFrom?: string;
  labelTo?: string;
  from: Date | null;
  to: Date | null;
  onFromChange: (value: Date | null) => void;
  onToChange: (value: Date | null) => void;
  error?: boolean;
}): React.JSX.Element {
  return (
    <>
      <DateField
        label={labelFrom}
        value={from}
        onChange={(value) => {
          onFromChange(value);
        }}
        maxDate={to ?? undefined}
        error={error}
      />
      <DateField
        label={labelTo}
        value={to}
        onChange={(value) => {
          onToChange(value);
        }}
        minDate={from ?? undefined}
        error={error}
      />
    </>
  );
}
