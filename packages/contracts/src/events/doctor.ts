import { z } from 'zod';
import { eventEnvelope } from './common';
import { doctorScheduleSchema, doctorStatusSchema } from '../domain';

const doctorCore = {
  doctorId: z.string().min(1),
  status: doctorStatusSchema,
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().min(1).optional(),
  specializationId: z.string().min(1),
  specializationName: z.string().min(1),
  schedule: doctorScheduleSchema,
  photoKey: z.string().min(1).optional(),
};

export const doctorCreatedV1Payload = z.object(doctorCore);
export const doctorCreatedV1 = eventEnvelope(doctorCreatedV1Payload);

export const doctorUpdatedV1Payload = z.object(doctorCore);
export const doctorUpdatedV1 = eventEnvelope(doctorUpdatedV1Payload);

export const specializationChangedV1Payload = z.object({
  specId: z.string().min(1),
  name: z.string().min(1),
});
export const specializationChangedV1 = eventEnvelope(specializationChangedV1Payload);
