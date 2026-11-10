import { z } from 'zod';
import { eventEnvelope } from './common';
import { appointmentStatusSchema, slotSchema } from '../domain';

/** Денализованные поля записи (architecture.md §5, п.2) — без них отчёты и списки ходили бы через сеть. */
const appointmentCore = {
  appointmentId: z.string().min(1),
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  doctorId: z.string().min(1),
  doctorName: z.string().min(1),
  specializationName: z.string().min(1),
  slot: slotSchema,
};

export const appointmentSubmittedV1Payload = z.object(appointmentCore);
export const appointmentSubmittedV1 = eventEnvelope(appointmentSubmittedV1Payload);

export const appointmentApprovedV1Payload = z.object(appointmentCore);
export const appointmentApprovedV1 = eventEnvelope(appointmentApprovedV1Payload);

export const appointmentDeclinedV1Payload = z.object({
  ...appointmentCore,
  reason: z.string().min(1).optional(),
});
export const appointmentDeclinedV1 = eventEnvelope(appointmentDeclinedV1Payload);

/**
 * 10.3/6.2: отмена — статус НЕ меняется по канону, previousStatus говорит
 * проекции отчёта, была ли запись учтена. Снапшот (appointmentCore) — тот же,
 * что у approved/declined/completed: им питаются письма 6.2 и журналы.
 */
export const appointmentCancelledV1Payload = z.object({
  ...appointmentCore,
  /** Откуда отменена (SUBMITTED/APPROVED) — для счётчиков проекции (5.4/канон §1). */
  previousStatus: appointmentStatusSchema.optional(),
});
export const appointmentCancelledV1 = eventEnvelope(appointmentCancelledV1Payload);

export const appointmentCompletedV1Payload = z.object(appointmentCore);
export const appointmentCompletedV1 = eventEnvelope(appointmentCompletedV1Payload);

/** Снимок врача/слота для события переноса (10.3). */
const rescheduleSide = z.object({
  doctorId: z.string().min(1),
  doctorName: z.string().min(1),
  specializationId: z.string().min(1),
  specializationName: z.string().min(1),
  slot: slotSchema,
});

/**
 * 10.3 (Этап 2.1): перенос записи — статус НЕ меняется, старый/новый слот и
 * врач в payload: журнал переносов и будущая проекция отчёта (перемещение
 * счётчика из APPROVED по ячейке (специализация, месяц)).
 */
export const appointmentRescheduledV1Payload = z.object({
  appointmentId: z.string().min(1),
  patientId: z.string().min(1),
  /** Статус ДО переноса (для счётчиков: двигаем только APPROVED). */
  previousStatus: appointmentStatusSchema,
  old: rescheduleSide,
  new: rescheduleSide,
  reason: z.string().min(1).optional(),
});
export const appointmentRescheduledV1 = eventEnvelope(appointmentRescheduledV1Payload);
