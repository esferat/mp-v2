import TextField, { type TextFieldProps } from '@mui/material/TextField';
import { forwardRef, type ReactNode } from 'react';

export type MpTextFieldProps = TextFieldProps & {
  /** Удобная обёртка над `slotProps.input.startAdornment`. */
  startAdornment?: ReactNode;
  /** Удобная обёртка над `slotProps.input.endAdornment`. */
  endAdornment?: ReactNode;
};

/**
 * Поле ввода mp-ui-kit.
 *
 * Скруглённая обводка 8px, мягкий фон, подпись поля полужирная.
 *
 * @example
 * <MpTextField label="Email" placeholder="user@example.com" required />
 */
export const MpTextField = forwardRef<HTMLDivElement, MpTextFieldProps>(function MpTextField(
  { startAdornment, endAdornment, slotProps, ...props },
  ref,
) {
  const inputSlot = {
    ...(slotProps?.input ?? {}),
    ...(startAdornment !== undefined ? { startAdornment } : {}),
    ...(endAdornment !== undefined ? { endAdornment } : {}),
  };

  return <TextField ref={ref} slotProps={{ ...slotProps, input: inputSlot }} {...props} />;
});
