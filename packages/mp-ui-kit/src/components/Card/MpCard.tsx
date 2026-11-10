import Card, { type CardProps } from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import { forwardRef, type ReactNode } from 'react';

export type MpCardVariant = 'elevated' | 'outlined' | 'flat';

export interface MpCardProps extends Omit<CardProps, 'variant'> {
  /**
   * Визуальный стиль карточки.
   * - `elevated` — тень + граница;
   * - `outlined` — только граница;
   * - `flat` — без границы и тени.
   * @default 'elevated'
   */
  variant?: MpCardVariant;
}

/**
 * Внутренний отступ контента. Строки с `px`: числа в MUI `sx` умножаются
 * на `theme.spacing` (8px) — «12» давало 96px вместо задуманных 12 (stories:
 * sm=12, md=16, lg=24; макеты: `.card { padding: 24px }`).
 */
const paddingScale: Record<'none' | 'sm' | 'md' | 'lg', string> = {
  none: '0px',
  sm: '12px',
  md: '16px',
  lg: '24px',
};

/** `:last-child` — MUI-дефолт и override темы задают свой нижний отступ; синхронизируем со всем контентом. */
function paddingStyles(padding: keyof typeof paddingScale): Record<string, unknown> {
  const value = paddingScale[padding];
  return { padding: value, '&:last-child': { paddingBottom: value } };
}

export interface MpCardContentProps {
  /** Внутренний отступ. @default 'md' */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children?: ReactNode;
  className?: string;
  sx?: object;
}

export interface MpCardActionsProps {
  /** Внутренний отступ. @default 'md' */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children?: ReactNode;
  className?: string;
  sx?: object;
}

/**
 * Карточка mp-ui-kit: скругление 12px, граница из токенов, мягкая тень.
 *
 * @example
 * <MpCard variant="elevated">
 *   <MpCardContent>Содержимое</MpCardContent>
 *   <MpCardActions>...</MpCardActions>
 * </MpCard>
 */
export const MpCard = forwardRef<HTMLDivElement, MpCardProps>(function MpCard(
  { variant = 'elevated', children, sx, ...props },
  ref,
) {
  const variantStyles =
    variant === 'flat'
      ? { boxShadow: 'none', border: 'none' }
      : variant === 'outlined'
        ? { boxShadow: 'none' }
        : {};

  return (
    <Card
      ref={ref}
      elevation={0}
      sx={[variantStyles, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
      {...props}
    >
      {children}
    </Card>
  );
});

/** Контент карточки с отступом из токенов. */
export const MpCardContent = forwardRef<HTMLDivElement, MpCardContentProps>(function MpCardContent(
  { padding = 'md', children, sx, ...props },
  ref,
) {
  return (
    <CardContent
      ref={ref}
      sx={[paddingStyles(padding), ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
      {...props}
    >
      {children}
    </CardContent>
  );
});

/** Нижняя панель действий карточки. */
export const MpCardActions = forwardRef<HTMLDivElement, MpCardActionsProps>(function MpCardActions(
  { padding = 'md', children, sx, ...props },
  ref,
) {
  return (
    <CardActions
      ref={ref}
      sx={[paddingStyles(padding), ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
      {...props}
    >
      {children}
    </CardActions>
  );
});
