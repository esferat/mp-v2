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

/** Вид загружаемого файла (4.4: фото vs документ определяют бакет и MIME). */
export const fileKindSchema = z.enum(['PHOTO', 'DOCUMENT']);
export type FileKind = z.infer<typeof fileKindSchema>;

/**
 * Категория документа пациента (9.3): enum живёт в contracts,
 * поле в событии document.uploaded.v1 опционально (обратная совместимость v1).
 */
export const documentCategorySchema = z.enum(['ANALYSIS', 'REFERRAL', 'DISCHARGE', 'OTHER']);
export type DocumentCategory = z.infer<typeof documentCategorySchema>;

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
  /**
   * Длительность приёма, минут: {5, 10, 15, 20, 30} — час должен делиться
   * на n целых приёмов без остатка (60 % duration === 0).
   */
  durationMinutes: z
    .number()
    .int()
    .min(5)
    .max(30)
    .refine((value) => 60 % value === 0, {
      message: 'Длительность должна делить час без остатка (5, 10, 15, 20 или 30 мин)',
    }),
  /** Рабочие дни: 1 = понедельник … 7 = воскресенье */
  workDays: z.array(z.number().int().min(1).max(7)).min(1),
});
export type DoctorSchedule = z.infer<typeof doctorScheduleSchema>;
