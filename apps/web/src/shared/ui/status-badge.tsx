import type { ReactNode } from 'react';
import { Chip, type ChipProps } from '@mui/material';

/**
 * Цвета статусов записи/врача/истории — из темы (2.2: токены только через
 * тему, «сырые» цвета в компонентах запрещены).
 */
export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

const TONE_COLOR: Record<StatusTone, ChipProps['color']> = {
  neutral: 'default',
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
};

/** Бейдж статуса (SUBMITTED/APPROVED/…, ACTIVE/INACTIVE, статусы истории). */
export function StatusBadge({
  label,
  tone = 'neutral',
}: {
  label: ReactNode;
  tone?: StatusTone;
}): React.JSX.Element {
  return <Chip label={label} color={TONE_COLOR[tone]} size="small" variant="outlined" />;
}
