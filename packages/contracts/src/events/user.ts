import { z } from 'zod';
import { eventEnvelope } from './common';
import { roleSchema } from '../domain';

export const userRegisteredV1Payload = z.object({
  userId: z.string().min(1),
  email: z.email(),
  /** Локаль письма (по умолчанию русский) */
  locale: z.string().min(2).default('ru'),
});
export const userRegisteredV1 = eventEnvelope(userRegisteredV1Payload);

export const userRoleChangedV1Payload = z.object({
  userId: z.string().min(1),
  roles: z.array(roleSchema).min(1),
});
export const userRoleChangedV1 = eventEnvelope(userRoleChangedV1Payload);
