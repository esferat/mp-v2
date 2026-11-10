import { z } from 'zod';
import { documentCategorySchema, fileKindSchema, ownerTypeSchema } from '../domain';
import { paginationQuerySchema } from './common';

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
  /**
   * Presigned-ссылка на аватар (TTL 5 мин) — для отображения в профиле
   * (3.4/4.3). Аддитивное поле: потребители, которым оно не нужно, игнорируют.
   */
  photoUrl: z.url().optional(),
});
export type Patient = z.infer<typeof patientSchema>;

/** Поля multipart-формы POST /api/files/upload (4.4): сам файл валидирует сервер. */
export const uploadFileFieldsSchema = z.object({
  ownerType: ownerTypeSchema,
  ownerId: z.string().min(1).max(100),
  kind: fileKindSchema,
  category: documentCategorySchema.optional(),
});
export type UploadFileFields = z.infer<typeof uploadFileFieldsSchema>;

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

/** Метаданные файла в списке (4.5/9.3): без ключей чужих владельцев. */
export const fileMetaSchema = z.object({
  key: z.string().min(1),
  ownerType: ownerTypeSchema,
  ownerId: z.string().min(1),
  mime: z.string().min(1),
  size: z.number().int().min(0),
  uploadedBy: z.string().min(1),
  category: documentCategorySchema.optional(),
  createdAt: z.iso.datetime(),
});
export type FileMeta = z.infer<typeof fileMetaSchema>;

/** GET /api/files?ownerType&ownerId — список файлов владельца (владелец/ADMIN). */
export const fileListQuerySchema = paginationQuerySchema.extend({
  ownerType: ownerTypeSchema,
  ownerId: z.string().min(1),
});
export type FileListQuery = z.infer<typeof fileListQuerySchema>;

export const fileListResponseSchema = z.object({
  items: z.array(fileMetaSchema),
  total: z.number().int().min(0),
});
export type FileListResponse = z.infer<typeof fileListResponseSchema>;

/** GET /api/patients — админский список (4.1). */
export const patientListQuerySchema = paginationQuerySchema.extend({
  /** Подстрока поиска по ФИО/email (без учёта регистра). */
  search: z.string().min(1).max(200).optional(),
});
export type PatientListQuery = z.infer<typeof patientListQuerySchema>;

export const patientListItemSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().min(1).optional(),
  birthDate: z.iso.date(),
  email: z.email(),
  /** Дата регистрации (день, 4.1: registrationDate в списке). */
  registrationDate: z.iso.date(),
  /** presigned GET, TTL 5 мин — подписывается при выдаче списка. */
  photoUrl: z.url().optional(),
});
export type PatientListItem = z.infer<typeof patientListItemSchema>;

export const patientListResponseSchema = z.object({
  items: z.array(patientListItemSchema),
  total: z.number().int().min(0),
});
export type PatientListResponse = z.infer<typeof patientListResponseSchema>;

/** PUT /api/patient/:id — обновление карточки (4.2): id сверяется с путём. */
export const updatePatientRequestSchema = createPatientRequestSchema
  // userId не меняется: привязка к Keycloak фиксирована при создании
  .omit({ userId: true })
  .extend({
    id: z.string().min(1).optional(),
  });
export type UpdatePatientRequest = z.infer<typeof updatePatientRequestSchema>;
