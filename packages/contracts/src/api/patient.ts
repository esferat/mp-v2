import { z } from 'zod';

/** POST /api/patient (внутренний вызов identity → patient, сага 1.4). */
export const createPatientRequestSchema = z.object({
  userId: z.string().min(1),
  email: z.email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  middleName: z.string().min(1).max(100).optional(),
  birthDate: z.iso.date(),
});
export type CreatePatientRequest = z.infer<typeof createPatientRequestSchema>;

/** Карточка пациента (patient-service; на Этапе 1 — заглушка с тем же контрактом). */
export const patientSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().min(1).optional(),
  birthDate: z.iso.date(),
  email: z.email(),
  registeredAt: z.iso.datetime(),
});
export type Patient = z.infer<typeof patientSchema>;

/** POST /api/files/upload (multipart) — ответ file-service. */
export const uploadFileResponseSchema = z.object({
  key: z.string().min(1),
  bucket: z.string().min(1),
  size: z.number().int().min(0),
  mime: z.string().min(1),
});
export type UploadFileResponse = z.infer<typeof uploadFileResponseSchema>;

/** GET /api/files/:key — presigned URL с TTL. */
export const fileDownloadSchema = z.object({
  url: z.url(),
  expiresInSeconds: z.number().int().min(1),
});
export type FileDownload = z.infer<typeof fileDownloadSchema>;
