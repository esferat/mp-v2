import { z } from 'zod';
import { doctorScheduleSchema } from '../domain';

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

/**
 * POST /api/identity/doctors (9.1, только ADMIN): сага создания врача с
 * учётной записью — пользователь Keycloak с ролью DOCTOR → catalog создаёт
 * врача с userId → связка user ↔ doctor готова. Идемпотентность по email:
 * существующий пользователь переиспользуется (AC 9.1).
 */
export const registerDoctorRequestSchema = z.object({
  email: z.email(),
  /** минимум 8 символов (functional-spec, 1.4) */
  password: z.string().min(8).max(72),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  middleName: z.string().min(1).max(100).optional(),
  specializationId: z.string().min(1),
  schedule: doctorScheduleSchema,
});
export type RegisterDoctorRequest = z.infer<typeof registerDoctorRequestSchema>;

export const registerDoctorResponseSchema = z.object({
  userId: z.string().min(1),
  doctorId: z.string().min(1),
});
export type RegisterDoctorResponse = z.infer<typeof registerDoctorResponseSchema>;

/**
 * GET /api/identity/me (10.1, Этап 2.1): профиль текущего пользователя —
 * источник истины Keycloak (email, ФИО) + realm-роли из токена.
 */
export const meProfileSchema = z.object({
  email: z.email(),
  /** Без min(1): Keycloak может вернуть пустое ФИО (валидируем при сохранении). */
  firstName: z.string(),
  lastName: z.string(),
  roles: z.array(z.string()),
});
export type MeProfile = z.infer<typeof meProfileSchema>;

/**
 * PATCH /api/identity/me (10.1): правка СВОИХ данных — только переданные
 * поля; занятый email → 409 с полем `email` (проверка — единая функция
 * identity, источник истины — Keycloak).
 */
export const updateMeSchema = z
  .object({
    email: z.email().optional(),
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: 'Укажите хотя бы одно поле для изменения',
  });
export type UpdateMeRequest = z.infer<typeof updateMeSchema>;
