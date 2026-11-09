import Box, { type BoxProps } from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

export interface MpSpinnerProps extends BoxProps {
  /** Размер индикатора, px. @default 32 */
  size?: number;
  /** Подпись под индикатором («Загрузка…»). */
  label?: ReactNode;
  /** Минимальная высота блока (чтобы не прыжал контент). @default 120 */
  minHeight?: number;
}

/**
 * Центрированный спиннер mp-ui-kit.
 *
 * @example
 * <MpSpinner label="Загрузка данных…" />
 */
export function MpSpinner({ size = 32, label, minHeight = 120, sx, ...props }: MpSpinnerProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        minHeight,
        ...sx,
      }}
      {...props}
    >
      <CircularProgress size={size} />
      {label ? (
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      ) : null}
    </Box>
  );
}
