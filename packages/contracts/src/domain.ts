import { z } from 'zod';

/**
 * Общие доменные примитивы контрактов.
 * Используются и событиями (events/), и HTTP-схемами (api/) — знание живёт в одном месте (DRY).
 */

/** Роли realm Keycloak (architecture.md §8). */
export const roleSchema = z.enum(['ADMIN', 'USER', 'DOCTOR']);
export type Role = z.infer<typeof roleSchema>;

/** Статус врача в каталоге. */
export const doctorStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);
export type DoctorStatus = z.infer<typeof doctorStatusSchema>;

/** Статус записи на приём (functional-spec.md §1, S4.4). */
export const appointmentStatusSchema = z.enum([
  'SUBMITTED',
  'APPROVED',
  'DECLINED',
  'CANCELLED',
  'COMPLETED',
]);
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

/** Владелец файла (file-service, functional-spec.md §1). */
export const ownerTypeSchema = z.enum(['PATIENT', 'DOCTOR']);
export type OwnerType = z.infer<typeof ownerTypeSchema>;

const timeRegex = /^\d{2}:\d{2}$/;

/** Слот: дата и локальное время начала/конца (scheduling-service). */
export const slotSchema = z.object({
  localDate: z.iso.date(),
  start: z.string().regex(timeRegex),
  end: z.string().regex(timeRegex),
});
export type Slot = z.infer<typeof slotSchema>;

/** Расписание врача (catalog-service; копия — в scheduling). */
export const doctorScheduleSchema = z.object({
  /** Начало рабочего дня, HH:mm */
  startTime: z.string().regex(timeRegex),
  /** Конец рабочего дня, HH:mm */
  endTime: z.string().regex(timeRegex),
  /** Длительность приёма, минут (5–240) */
  durationMinutes: z.number().int().min(5).max(240),
  /** Рабочие дни: 1 = понедельник … 7 = воскресенье */
  workDays: z.array(z.number().int().min(1).max(7)).min(1),
});
export type DoctorSchedule = z.infer<typeof doctorScheduleSchema>;
