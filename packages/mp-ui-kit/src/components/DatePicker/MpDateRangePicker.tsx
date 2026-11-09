import Stack from '@mui/material/Stack';
import type { ReactNode } from 'react';
import { MpDatePicker } from './MpDatePicker';

export interface MpDateRangePickerProps {
  /** Подпись левой границы. @default 'С' */
  startLabel?: ReactNode;
  /** Подпись правой границы. @default 'По' */
  endLabel?: ReactNode;
  startDate?: Date | null;
  endDate?: Date | null;
  onStartDateChange?: (date: Date | null) => void;
  onEndDateChange?: (date: Date | null) => void;
  /** Нижняя граница периода (не раньше начала). */
  minDate?: Date | null;
  /** Верхняя граница периода (не позже конца). */
  maxDate?: Date | null;
  /** Ошибка валидации (например, «начало позже конца»). */
  error?: boolean;
  helperText?: ReactNode;
  disabled?: boolean;
  /** Размер полей. @default 'small' */
  size?: 'small' | 'medium';
  className?: string;
}

/**
 * Диапазон дат из двух `DatePicker` (community-решение, functional-spec §2.2).
 * Требует `MpDateProvider`.
 *
 * @example
 * <MpDateRangePicker
 *   startDate={from}
 *   endDate={to}
 *   onStartDateChange={setFrom}
 *   onEndDateChange={setTo}
 * />
 */
export function MpDateRangePicker({
  startLabel = 'С',
  endLabel = 'По',
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  minDate,
  maxDate,
  error,
  helperText,
  disabled,
  size = 'small',
  className,
}: MpDateRangePickerProps) {
  return (
    <Stack
      className={className}
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}
    >
      <MpDatePicker
        label={startLabel}
        value={startDate ?? null}
        onChange={onStartDateChange}
        minDate={minDate ?? undefined}
        maxDate={endDate ?? maxDate ?? undefined}
        disabled={disabled}
        size={size}
        error={error}
        helperText={helperText}
      />
      <MpDatePicker
        label={endLabel}
        value={endDate ?? null}
        onChange={onEndDateChange}
        minDate={startDate ?? minDate ?? undefined}
        maxDate={maxDate ?? undefined}
        disabled={disabled}
        size={size}
      />
    </Stack>
  );
}
