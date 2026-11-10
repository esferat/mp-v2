import Box from '@mui/material/Box';
import { forwardRef } from 'react';
import { mpTokens } from '../../theme/tokens';

export type MpStatusColor =
  'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface MpStatusMeta {
  /** Подпись по умолчанию (ru). */
  label: string;
  /** Семантический цвет статуса (точка и текст). */
  color: MpStatusColor;
}

/**
 * Реестр статусов — цвета статусов записей/врачей/истории
 * (design/appointments.md, design/history.md, design/doctors-list.md,
 * design/doctor-schedule.md, visual/_shared.css `.status.*`).
 */
export const mpStatuses = {
  // Запись (entities/appointment): SUBMITTED → APPROVED | DECLINED, отмена → CANCELLED;
  // завершение приёма — COMPLETED (синий, design/doctor-schedule.md)
  SUBMITTED: { label: 'В ожидании', color: 'warning' },
  APPROVED: { label: 'Принята', color: 'success' },
  DECLINED: { label: 'Отклонена', color: 'error' },
  CANCELLED: { label: 'Отменена', color: 'neutral' },
  COMPLETED: { label: 'Приём завершён', color: 'info' },
  // Врач (entities/doctor)
  ACTIVE: { label: 'Активен', color: 'success' },
  INACTIVE: { label: 'Неактивен', color: 'neutral' },
  // Слоты и общие состояния
  AVAILABLE: { label: 'Свободно', color: 'primary' },
  BOOKED: { label: 'Занято', color: 'neutral' },
  NEW: { label: 'Новая', color: 'info' },
  PENDING: { label: 'Ожидает', color: 'warning' },
  CONFIRMED: { label: 'Подтверждена', color: 'success' },
  FAILED: { label: 'Ошибка', color: 'error' },
} as const satisfies Record<string, MpStatusMeta>;

export type MpStatus = keyof typeof mpStatuses;

export interface MpStatusBadgeProps {
  /** Статус из реестра. */
  status: MpStatus;
  /** Переопределить подпись (свой текст). */
  label?: string;
  /** Размер бейджа. @default 'small' */
  size?: 'small' | 'medium';
  /** @deprecated Точечный бейдж не имеет вариантов заливки — проп игнорируется (совместимость API). */
  variant?: 'filled' | 'outlined';
  className?: string;
}

/**
 * Бейдж статуса: цветная точка + подпись (visual/_shared.css `.status`):
 * точка 8×8 и текст 12px/600 одним цветом; «нейтральные» статусы —
 * текст `neutral-500`, точка `neutral-400`. Цвет и подпись берутся
 * из реестра статусов.
 *
 * @example
 * <MpStatusBadge status="SUBMITTED" />
 * <MpStatusBadge status="COMPLETED" label="✓ Есть" />
 */
export const MpStatusBadge = forwardRef<HTMLSpanElement, MpStatusBadgeProps>(function MpStatusBadge(
  { status, label, size = 'small', className },
  ref,
) {
  const meta = mpStatuses[status];
  const dotSize = size === 'medium' ? 10 : 8;

  return (
    <Box
      ref={ref}
      component="span"
      className={className}
      sx={(theme) => {
        const isNeutral = meta.color === 'neutral';
        const main = isNeutral
          ? theme.palette.text.secondary
          : theme.palette[meta.color as Exclude<MpStatusColor, 'neutral'>].main;
        return {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: size === 'medium' ? 14 : 12,
          fontWeight: 600,
          lineHeight: 1.4,
          color: main,
          whiteSpace: 'nowrap',
          verticalAlign: 'middle',
          '& .MpStatusBadge-dot': {
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            flexShrink: 0,
            backgroundColor: isNeutral ? mpTokens.neutral[400] : main,
          },
        };
      }}
    >
      <Box component="span" className="MpStatusBadge-dot" aria-hidden />
      {label ?? meta.label}
    </Box>
  );
});
