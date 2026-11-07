import { z } from 'zod';
import { eventEnvelope } from './common';

const patientCore = {
  patientId: z.string().min(1),
  userId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().min(1).optional(),
  birthDate: z.iso.date(),
  email: z.email(),
};

export const patientCreatedV1Payload = z.object(patientCore);
export const patientCreatedV1 = eventEnvelope(patientCreatedV1Payload);

export const patientUpdatedV1Payload = z.object(patientCore);
export const patientUpdatedV1 = eventEnvelope(patientUpdatedV1Payload);
