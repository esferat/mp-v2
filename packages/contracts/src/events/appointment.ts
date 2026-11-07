import { z } from 'zod';
import { eventEnvelope } from './common';
import { slotSchema } from '../domain';

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

export const appointmentCancelledV1Payload = z.object({
  appointmentId: z.string().min(1),
});
export const appointmentCancelledV1 = eventEnvelope(appointmentCancelledV1Payload);

export const appointmentCompletedV1Payload = z.object(appointmentCore);
export const appointmentCompletedV1 = eventEnvelope(appointmentCompletedV1Payload);
