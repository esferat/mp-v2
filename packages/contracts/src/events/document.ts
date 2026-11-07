import { z } from 'zod';
import { eventEnvelope } from './common';
import { ownerTypeSchema } from '../domain';

export const documentUploadedV1Payload = z.object({
  key: z.string().min(1),
  bucket: z.string().min(1),
  ownerType: ownerTypeSchema,
  ownerId: z.string().min(1),
  mime: z.string().min(1),
  size: z.number().int().min(0),
  /** Категория документа (справочная, расширяется на Этапе 2) */
  category: z.string().min(1).optional(),
  /** userId загрузившего (врач/админ/пациент) */
  uploadedBy: z.string().min(1),
});
export const documentUploadedV1 = eventEnvelope(documentUploadedV1Payload);

export const documentDeletedV1Payload = z.object({
  key: z.string().min(1),
  ownerType: ownerTypeSchema,
  ownerId: z.string().min(1),
});
export const documentDeletedV1 = eventEnvelope(documentDeletedV1Payload);
