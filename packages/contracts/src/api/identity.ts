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

/**
 * GET /api/identity/users/:userId (только ADMIN): профиль пользователя для
 * админки — email врача в его карточке (3.2). Источник истины Keycloak,
 * как и у /me; роли в ответе не нужны (читает админ, не владелец).
 */
export const adminUserProfileSchema = z.object({
  userId: z.string().min(1),
  email: z.email(),
  firstName: z.string(),
  lastName: z.string(),
});
export type AdminUserProfile = z.infer<typeof adminUserProfileSchema>;

/**
 * PATCH /api/identity/users/:userId (только ADMIN): правка профиля пользователя
 * админом. Здесь — только email (ФИО врача правится в карточке каталога 3.2,
 * чтобы не плодить два источника). Занятый email → 409 с полем `email`.
 */
export const updateAdminUserProfileSchema = z.object({
  email: z.email(),
});
export type UpdateAdminUserProfileRequest = z.infer<typeof updateAdminUserProfileSchema>;

/**
 * POST /api/identity/doctors/:doctorId/account (только ADMIN): создать
 * учётную запись для УЖЕ существующего карточки врача и привязать её.
 * Правило: учётная запись врача создаётся администратором ВСЕГДА —
 * сага та же, что в 9.1 (идемпотентность по email, компенсация при сбое
 * catalog), но шаг B — привязка к карточке вместо её создания.
 * Email занят другим врачом → 409 с полем `email`.
 */
export const createDoctorAccountRequestSchema = z.object({
  email: z.email(),
  /** минимум 8 символов (functional-spec, 1.4) */
  password: z.string().min(8).max(72),
  /** ФИО дублируются в Keycloak — профиль врача читает их оттуда (10.1). */
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  middleName: z.string().min(1).max(100).optional(),
});
export type CreateDoctorAccountRequest = z.infer<typeof createDoctorAccountRequestSchema>;

export const createDoctorAccountResponseSchema = z.object({
  userId: z.string().min(1),
});
export type CreateDoctorAccountResponse = z.infer<typeof createDoctorAccountResponseSchema>;
