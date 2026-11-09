import Chip, { type ChipProps } from '@mui/material/Chip';
import { forwardRef } from 'react';

export type MpStatusColor = ChipProps['color'];

export interface MpStatusMeta {
  /** Подпись по умолчанию (ru). */
  label: string;
  /** Цвет чипа из палитры темы. */
  color: MpStatusColor;
}

/**
 * Реестр статусов — цвета статусов записей/врачей/истории
 * (design/appointments.md, design/history.md, design/doctors-list.md,
 * design/doctor-schedule.md).
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
  /** Размер чипа. @default 'small' */
  size?: 'small' | 'medium';
  /** Стиль: filled (по умолчанию) или outlined. */
  variant?: 'filled' | 'outlined';
  className?: string;
}

/**
 * Бейдж статуса: цвет и подпись берутся из реестра статусов.
 *
 * @example
 * <MpStatusBadge status="SUBMITTED" />
 * <MpStatusBadge status="APPROVED" variant="outlined" />
 */
export const MpStatusBadge = forwardRef<HTMLDivElement, MpStatusBadgeProps>(function MpStatusBadge(
  { status, label, size = 'small', variant = 'filled', className },
  ref,
) {
  const meta = mpStatuses[status];

  return (
    <Chip
      ref={ref}
      size={size}
      variant={variant}
      color={meta.color}
      label={label ?? meta.label}
      className={className}
    />
  );
});
