import { z } from 'zod';

/**
 * Схема окружения витрины (0.7, 1.1): старт падает с понятной ошибкой.
 * Next.js читает env сам, но для серверного кода нужен типизированный доступ.
 */
export const webEnvSchema = z.object({
  /** Публичный адрес витрины (для Auth.js redirect и logout). */
  AUTH_URL: z.url().default('http://localhost:3000'),
  /** Сессионная подпись (HttpOnly-кука). Обязательна в production. */
  AUTH_SECRET: z.string().min(16).default('dev-only-secret-change-me'),
  /** Публичный клиент Keycloak (PKCE, без секрета). */
  AUTH_KEYCLOAK_ID: z.string().min(1).default('next-web'),
  AUTH_KEYCLOAK_SECRET: z.string().default(''),
  /** Issuer OIDC: <KEYCLOAK_HOSTNAME>/realms/<realm> — браузерный origin. */
  AUTH_KEYCLOAK_ISSUER: z.string().min(1).default('http://localhost:8180/realms/medical-portal'),
  /** Реалм Keycloak (составная часть OIDC-путей token/userinfo). */
  AUTH_KEYCLOAK_REALM: z.string().min(1).default('medical-portal'),
  /**
   * Внутренний адрес Keycloak для СЕРВЕРНЫХ OIDC-вызовов (token/userinfo):
   * localhost:8180 из контейнера недоступен — endpoints разделены (1.1).
   */
  AUTH_KEYCLOAK_INTERNAL_URL: z.string().min(1).default('http://keycloak:8080'),
  /** Внутренний адрес gateway для BFF-роутов (2.6). */
  GATEWAY_INTERNAL_URL: z.string().min(1).default('http://gateway:4000'),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export function loadWebEnv(source: NodeJS.ProcessEnv = process.env): WebEnv {
  const parsed = webEnvSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Некорректное окружение web:\n${details}`);
  }
  return parsed.data;
}

let cached: WebEnv | null = null;

/** Ленивая загрузка окружения (fail-fast при первом обращении). */
export function getWebEnv(): WebEnv {
  cached ??= loadWebEnv();
  return cached;
}
