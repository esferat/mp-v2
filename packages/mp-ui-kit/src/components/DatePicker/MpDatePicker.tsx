import { DatePicker, type DatePickerProps } from '@mui/x-date-pickers/DatePicker';
import type { ReactNode } from 'react';

export type MpDatePickerProps = Omit<DatePickerProps, 'label'> & {
  /** Подпись поля. */
  label?: ReactNode;
  /** Текст под полем (подсказка или ошибка). */
  helperText?: ReactNode;
  /** Ошибка валидации. */
  error?: boolean;
  /** Обязательное поле. */
  required?: boolean;
  /** Размер поля. @default 'small' */
  size?: 'small' | 'medium';
};

/**
 * Поле выбора даты mp-ui-kit (требует `MpDateProvider`).
 *
 * @example
 * <MpDatePicker label="Дата записи" value={date} onChange={setDate} />
 */
export function MpDatePicker({
  label,
  helperText,
  error,
  required,
  size = 'small',
  format = 'dd.MM.yyyy',
  slotProps,
  ...props
}: MpDatePickerProps) {
  return (
    <DatePicker
      format={format}
      {...props}
      slotProps={{
        ...slotProps,
        textField: {
          size,
          fullWidth: true,
          label,
          error,
          required,
          helperText,
          ...slotProps?.textField,
        },
      }}
    />
  );
}
