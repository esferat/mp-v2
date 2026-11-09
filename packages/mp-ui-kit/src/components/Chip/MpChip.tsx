import Chip, { type ChipProps } from '@mui/material/Chip';
import { forwardRef } from 'react';

export interface MpChipProps extends ChipProps {
  /** Размер. @default 'small' */
  size?: 'small' | 'medium';
  /**
   * Выбранное состояние (слоты приёма, макет booking.md:
   * «свободные — contained, выбранный — filled primary»).
   */
  selected?: boolean;
}

/**
 * Чип mp-ui-kit: теги, фильтры, статусы, слоты приёма.
 *
 * Доступны кастомные цвета темы: `brand`, `neutral`.
 *
 * @example
 * <MpChip color="brand" label="Новое" />
 * <MpChip label="11:30" selected onClick={pickSlot} />
 * <MpChip label="10:00" disabled />
 */
export const MpChip = forwardRef<HTMLDivElement, MpChipProps>(function MpChip(
  { size = 'small', selected = false, color, variant, ...props },
  ref,
) {
  return (
    <Chip
      ref={ref}
      size={size}
      color={selected ? 'primary' : color}
      variant={selected ? 'filled' : variant}
      {...props}
    />
  );
});
