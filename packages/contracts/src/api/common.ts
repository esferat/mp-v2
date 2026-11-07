import { z } from 'zod';

/** Единый формат ошибки API (gateway, BFF). */
export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  requestId: z.string().min(1).optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

/** Пагинация offset/limit (query-параметры приходят строками — coerce). */
export const paginationQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Пустой ответ (204). */
export const okSchema = z.object({ ok: z.literal(true) });
