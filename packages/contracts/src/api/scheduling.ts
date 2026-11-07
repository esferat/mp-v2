import { z } from 'zod';
import { appointmentStatusSchema, slotSchema } from '../domain';
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
});
export type SlotsQuery = z.infer<typeof slotsQuerySchema>;

export const slotListSchema = z.array(slotSchema.extend({ doctorId: z.string().min(1) }));
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
  specializationName: z.string().min(1),
  slot: slotSchema,
  declineReason: z.string().min(1).optional(),
  createdAt: z.iso.datetime(),
});
export type Appointment = z.infer<typeof appointmentSchema>;

export const appointmentListQuerySchema = paginationQuerySchema.extend({
  status: appointmentStatusSchema.optional(),
  specId: z.string().min(1).optional(),
  doctorId: z.string().min(1).optional(),
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
