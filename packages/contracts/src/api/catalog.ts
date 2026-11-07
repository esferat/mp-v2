import { z } from 'zod';
import { doctorScheduleSchema, doctorStatusSchema } from '../domain';
import { paginationQuerySchema } from './common';

export const doctorListItemSchema = z.object({
  id: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().min(1).optional(),
  specializationId: z.string().min(1),
  specializationName: z.string().min(1),
  status: doctorStatusSchema,
  /** presigned GET, TTL 5 мин — формируется file/catalog при выдаче */
  photoUrl: z.url().optional(),
  schedule: doctorScheduleSchema,
});
export type DoctorListItem = z.infer<typeof doctorListItemSchema>;

export const doctorListQuerySchema = paginationQuerySchema.extend({
  search: z.string().min(1).optional(),
  status: doctorStatusSchema.optional(),
});
export type DoctorListQuery = z.infer<typeof doctorListQuerySchema>;

/** Ответ списка врачей: total нужен пагинации (2.5/3.1 AC). */
export const doctorListResponseSchema = z.object({
  items: z.array(doctorListItemSchema),
  total: z.number().int().min(0),
});
export type DoctorListResponse = z.infer<typeof doctorListResponseSchema>;

export const createDoctorSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  middleName: z.string().min(1).max(100).optional(),
  specializationId: z.string().min(1),
  schedule: doctorScheduleSchema,
});
export type CreateDoctorRequest = z.infer<typeof createDoctorSchema>;

export const updateDoctorSchema = createDoctorSchema.extend({
  status: doctorStatusSchema.optional(),
});
export type UpdateDoctorRequest = z.infer<typeof updateDoctorSchema>;

export const specializationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  doctorsCount: z.number().int().min(0),
});
export type Specialization = z.infer<typeof specializationSchema>;

export const createSpecializationSchema = z.object({
  name: z.string().min(2).max(120),
});
export type CreateSpecializationRequest = z.infer<typeof createSpecializationSchema>;
