import Badge, { type BadgeProps } from '@mui/material/Badge';
import { forwardRef, type ReactNode } from 'react';

export interface MpBadgeProps extends BadgeProps {
  /** Максимальное отображаемое число (свыше — «99+»). @default 99 */
  max?: number;
}

/**
 * Счётчик/badge mp-ui-kit.
 *
 * @example
 * <MpBadge badgeContent={12}><MpButton>Сообщения</MpButton></MpBadge>
 */
export const MpBadge = forwardRef<HTMLSpanElement, MpBadgeProps>(function MpBadge(
  { max = 99, color = 'primary', variant = 'standard', children, ...props },
  ref,
) {
  return (
    <Badge ref={ref} max={max} color={color} variant={variant} {...props}>
      {children as ReactNode}
    </Badge>
  );
});
