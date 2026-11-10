import { type BaseEnv, loadEnv } from '@mp/service-kit';
import { z } from 'zod';

/**
 * Схема окружения identity (0.7, 1.4): старт падает с понятной ошибкой,
 * если переменных не хватает. Базовые поля (LOG_LEVEL и пр.) — в service-kit.
 */
export const IdentityEnvSchema = z.object({
  /// Порт по умолчанию — сервисный (перекрывает базовый 3000 из service-kit).
  PORT: z.coerce.number().int().min(1).max(65535).default(4001),
  /** URL своей БД: доступ только к db_identity (architecture.md §5). */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL обязателен'),

  // --- Keycloak Admin API (сага регистрации, 1.4) ---------------------------
  /// Внутренний адрес Keycloak для контейнеров.
  KEYCLOAK_INTERNAL_URL: z.string().min(1).default('http://keycloak:8080'),
  KEYCLOAK_REALM: z.string().min(1).default('medical-portal'),
  /// Service account «svc-identity» (manage-users) — client credentials.
  KEYCLOAK_SVC_IDENTITY_CLIENT_ID: z.string().min(1).default('svc-identity'),
  KEYCLOAK_SVC_IDENTITY_SECRET: z.string().min(1).default('dev-identity-secret'),

  // --- Вызовы на другие сервисы (сага, шаг B) ------------------------------
  /// patient-service напрямую (architecture.md §165: сервис → сервис).
  PATIENT_SERVICE_URL: z.string().min(1).default('http://patient:4003'),
  PATIENT_SERVICE_TIMEOUT_MS: z.coerce.number().int().min(100).default(10_000),
  /// catalog-service для саги врача (9.1: шаг B — создание врача с userId).
  CATALOG_SERVICE_URL: z.string().min(1).default('http://catalog:4002'),
});

export type IdentityEnv = BaseEnv & z.infer<typeof IdentityEnvSchema>;

export function loadIdentityEnv(source: NodeJS.ProcessEnv = process.env): IdentityEnv {
  return loadEnv(IdentityEnvSchema.shape, source);
}

let cached: IdentityEnv | null = null;

/** Ленивая загрузка окружения (fail-fast при первом обращении, обычно на старте). */
export function getIdentityEnv(): IdentityEnv {
  cached ??= loadIdentityEnv();
  return cached;
}
