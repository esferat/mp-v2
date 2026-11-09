import Chip, { type ChipProps } from '@mui/material/Chip';
import { forwardRef } from 'react';

export interface MpChipProps extends ChipProps {
  /** Размер. @default 'small' */
  size?: 'small' | 'medium';
}

/**
 * Чип mp-ui-kit: теги, фильтры, статусы.
 *
 * Доступны кастомные цвета темы: `brand`, `neutral`.
 *
 * @example
 * <MpChip color="brand" label="Новое" />
 */
export const MpChip = forwardRef<HTMLDivElement, MpChipProps>(function MpChip(
  { size = 'small', ...props },
  ref,
) {
  return <Chip ref={ref} size={size} {...props} />;
});
