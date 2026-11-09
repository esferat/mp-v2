import Button, { type ButtonProps } from '@mui/material/Button';
import { forwardRef } from 'react';

export type MpButtonProps = ButtonProps;

/**
 * Кнопка mp-ui-kit.
 *
 * Стили задаются темой: без заглавных букв, полужирный текст, скругление 8px, без тени.
 * Нативные `loading` / `loadingPosition` MUI показывают индикатор и блокируют кнопку.
 *
 * @example
 * <MpButton variant="contained" loading>Сохранить</MpButton>
 */
export const MpButton = forwardRef<HTMLButtonElement, MpButtonProps>(function MpButton(props, ref) {
  return <Button ref={ref} {...props} />;
});
