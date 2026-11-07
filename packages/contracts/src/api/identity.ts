import { z } from 'zod';

/** POST /api/identity/register (сага регистрации, S1.1). */
export const registerRequestSchema = z
  .object({
    email: z.email(),
    /** минимум 8 символов (functional-spec, 1.4) */
    password: z.string().min(8).max(72),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    middleName: z.string().min(1).max(100).optional(),
    birthDate: z.iso.date(),
  })
  .refine((value) => value.birthDate <= new Date().toISOString().slice(0, 10), {
    message: 'Дата рождения не может быть в будущем',
    path: ['birthDate'],
  });
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const registerResponseSchema = z.object({
  userId: z.string().min(1),
  email: z.email(),
});
export type RegisterResponse = z.infer<typeof registerResponseSchema>;
