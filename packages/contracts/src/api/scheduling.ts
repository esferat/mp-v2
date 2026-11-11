import { z } from 'zod';
import { appointmentStatusSchema, doctorScheduleSchema, slotSchema } from '../domain';
import { paginationQuerySchema } from './common';

/** GET /api/scheduling/slots?specId&from&to[&startTime&endTime] */
export const slotsQuerySchema = z.object({
  specId: z.string().min(1),
  from: z.iso.date(),
  to: z.iso.date(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  /**
   * `1` — вернуть и занятые слоты (`available: false`, сетка записи:
   * зелёные доступные / серые занятые). Без параметра — только свободные
   * (обратная совместимость: перенос записи, e2e).
   */
  includeBusy: z.enum(['1']).optional(),
});
export type SlotsQuery = z.infer<typeof slotsQuerySchema>;

/**
 * Свободные окна с ФИО врача: wizard записи группирует слоты по врачу
 * (design/booking.md шаг 2), не ходя в админский список врачей (3.1 AC: USER → 403).
 */
export const slotListSchema = z.array(
  slotSchema.extend({
    doctorId: z.string().min(1),
    doctorName: z.string().min(1),
    /** false — слот занят (сетка записи: зелёные доступные / серые занятые). */
    available: z.boolean(),
    /**
     * presigned-аватар врача (TTL 5 мин) — плитка выбора врача показывает
     * фото; нет фото или catalog недоступен — поле отсутствует (инициалы).
     */
    doctorPhotoUrl: z.url().optional(),
  }),
);
export type SlotList = z.infer<typeof slotListSchema>;

/** POST /api/scheduling/appointments */
export const bookAppointmentSchema = z.object({
  doctorId: z.string().min(1),
  /** Для ADMIN — явный пациент; для USER берётся из токена и поле игнорируется */
  patientId: z.string().min(1).optional(),
  slot: z.object({
    localDate: z.iso.date(),
    start: z.string().regex(/^\d{2}:\d{2}$/),
  }),
});
export type BookAppointmentRequest = z.infer<typeof bookAppointmentSchema>;

export const appointmentSchema = z.object({
  id: z.string().min(1),
  status: appointmentStatusSchema,
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  doctorId: z.string().min(1),
  doctorName: z.string().min(1),
  specializationId: z.string().min(1),
  specializationName: z.string().min(1),
  slot: slotSchema,
  declineReason: z.string().min(1).optional(),
  createdAt: z.iso.datetime(),
  /** Результат приёма для COMPLETED (9.2: история показывает read-only). */
  visitResult: z
    .object({
      conclusion: z.string().min(1),
      recommendations: z.string().min(1).optional(),
    })
    .optional(),
});
export type Appointment = z.infer<typeof appointmentSchema>;

export const appointmentListQuerySchema = paginationQuerySchema.extend({
  status: appointmentStatusSchema.optional(),
  specId: z.string().min(1).optional(),
  /**
   * Мультивыбор специализаций (5.4, админ): строка «id1,id2» либо
   * повторённый параметр `?specIds=id1&specIds=id2`.
   */
  specIds: z
    .union([z.string(), z.array(z.string().min(1))])
    .transform((value) => (Array.isArray(value) ? value : value.split(',')).filter(Boolean))
    .optional(),
  doctorId: z.string().min(1).optional(),
  /**
   * Мультивыбор врачей (5.4, админ «Управление записями»): строка «id1,id2»
   * либо повторённый параметр `?doctorIds=id1&doctorIds=id2`.
   */
  doctorIds: z
    .union([z.string(), z.array(z.string().min(1))])
    .transform((value) => (Array.isArray(value) ? value : value.split(',')).filter(Boolean))
    .optional(),
  patientId: z.string().min(1).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export type AppointmentListQuery = z.infer<typeof appointmentListQuerySchema>;

/** PUT /api/scheduling/appointments/:id/status */
export const setAppointmentStatusSchema = z.object({
  status: z.enum(['APPROVED', 'DECLINED']),
  reason: z.string().min(3).max(500).optional(),
});
export type SetAppointmentStatusRequest = z.infer<typeof setAppointmentStatusSchema>;

/** PUT /api/scheduling/appointments/:id/cancel (5.4): отмена из SUBMITTED/APPROVED. */
export const cancelAppointmentSchema = z.object({
  reason: z.string().min(3).max(500).optional(),
});
export type CancelAppointmentRequest = z.infer<typeof cancelAppointmentSchema>;

/**
 * PUT /api/scheduling/appointments/:id/reschedule (10.3, Этап 2.1): перенос
 * на другого врача/дату/время БЕЗ смены статуса (SUBMITTED/APPROVED → те же).
 * Конец окна вычисляется на сервере: начало + длительность расписания врача.
 */
export const rescheduleAppointmentSchema = z.object({
  /** Новый врач (опционально — можно менять только дату/время). */
  doctorId: z.string().min(1).optional(),
  localDate: z.iso.date(),
  /** HH:mm начала нового окна. */
  start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Некорректное время (HH:mm)'),
  /** Причина переноса — журнал (10.3). */
  reason: z.string().min(3).max(500).optional(),
});
export type RescheduleAppointmentRequest = z.infer<typeof rescheduleAppointmentSchema>;

/**
 * GET /api/scheduling/doctors/:id/schedule (10.3 UI): расписание врача из
 * копии (5.1) — недельный вид слотов в диалоге переноса (сетка времени,
 * рабочие дни).
 */
export const doctorScheduleResponseSchema = doctorScheduleSchema;
export type DoctorScheduleResponse = z.infer<typeof doctorScheduleResponseSchema>;

/** Ответ списка записей с пагинацией (5.4/5.5 AC: total нужен пагинации). */
export const appointmentListResponseSchema = z.object({
  items: z.array(appointmentSchema),
  total: z.number().int().min(0),
});
export type AppointmentListResponse = z.infer<typeof appointmentListResponseSchema>;

/**
 * Результат приёма (9.2): заключение обязательно (<= 4000), рекомендации —
 * по желанию (<= 4000); валидация живёт в домене scheduling.
 */
export const enterVisitResultSchema = z.object({
  conclusion: z.string().min(1).max(4000),
  recommendations: z.string().max(4000).optional(),
});
export type EnterVisitResultRequest = z.infer<typeof enterVisitResultSchema>;

/** Правка результата уже завершённого приёма (9.2). */
export const updateVisitResultSchema = enterVisitResultSchema;
export type UpdateVisitResultRequest = z.infer<typeof updateVisitResultSchema>;

/** Результат приёма в ответах API (9.2). */
export const visitResultSchema = z.object({
  appointmentId: z.string().min(1),
  conclusion: z.string().min(1),
  recommendations: z.string().min(1).optional(),
  /** Кто внёс (userId врача). */
  createdBy: z.string().min(1),
  updatedAt: z.iso.datetime(),
});
export type VisitResult = z.infer<typeof visitResultSchema>;

/** Пациент врача из его записей (9.3: /doctor/patients, distinct). */
export const doctorPatientSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  /** Последний приём (ISO-дата: YYYY-MM-DD). */
  lastVisit: z.iso.date().optional(),
});
export type DoctorPatient = z.infer<typeof doctorPatientSchema>;

export const doctorPatientListSchema = z.object({
  items: z.array(doctorPatientSchema),
  total: z.number().int().min(0),
});
export type DoctorPatientList = z.infer<typeof doctorPatientListSchema>;

/**
 * Внутренние вызовы file → scheduling (9.3): есть ли у врача действующая
 * связь с пациентом. Связь = запись APPROVED или COMPLETED (отменённая/
 * отклонённая запись доступа не даёт — AC 9.3 «потеря связи закрывает доступ»).
 * В gateway-реестр не входит: маршрут служебный, вызывается только файловым
 * сервисом напрямую (http://scheduling:4005).
 */
export const doctorRelationQuerySchema = z.object({
  /** Keycloak sub врача (не doctorId: file знает только subject.sub). */
  userId: z.string().min(1),
  patientId: z.string().min(1),
});
export type DoctorRelationQuery = z.infer<typeof doctorRelationQuerySchema>;

export const doctorRelationResponseSchema = z.object({
  related: z.boolean(),
});
export type DoctorRelationResponse = z.infer<typeof doctorRelationResponseSchema>;

/** Привязка sub → doctorId (9.3: file решает, свои ли файлы врача). */
export const doctorByUserResponseSchema = z.object({
  doctorId: z.string().min(1),
});
export type DoctorByUserResponse = z.infer<typeof doctorByUserResponseSchema>;
