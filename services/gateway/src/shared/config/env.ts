import { loadEnv, type BaseEnv } from '@mp/service-kit';
import { z } from 'zod';
import { ROLES, type Role } from '../../entities/authorization';

/**
 * Схема окружения gateway (0.7, 1.2): старт падает с понятной ошибкой,
 * если переменных не хватает. Базовые поля (LOG_LEVEL и пр.) — в service-kit.
 */
export const GatewayEnvSchema = z.object({
  /// Порт по умолчанию — сервисный (перекрывает базовый 3000 из service-kit).
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  // --- Keycloak (1.2: проверка токена по jwks реалма) -----------------------
  /// Внутренний адрес Keycloak для контейнеров (jwks); на хосте — localhost:8180.
  KEYCLOAK_INTERNAL_URL: z.string().min(1).default('http://keycloak:8080'),
  /// Публичный адрес — именно он стоит в claim `iss` токена (проверка issuer).
  KEYCLOAK_PUBLIC_URL: z.string().min(1).default('http://localhost:8180'),
  KEYCLOAK_REALM: z.string().min(1).default('medical-portal'),
  /// Ожидаемые aud токена (client_id через запятую).
  AUTH_AUDIENCE: z.string().min(1).default('next-web'),
  /// Роль по умолчанию, если в токене нет известных realm-ролей (пусто = не выдаётся).
  AUTH_DEFAULT_ROLES: z.string().default(''),

  // --- Маршрутизация на сервисы (1.2) ---------------------------------------
  /// Список "имя=http://адрес" через запятую; неизвестное имя → 404.
  SERVICE_URLS: z
    .string()
    .min(1)
    .default(
      [
        'identity=http://identity:4001',
        'catalog=http://catalog:4002',
        'patient=http://patient:4003',
        'file=http://file:4004',
        'scheduling=http://scheduling:4005',
        'report=http://report:4006',
        'notification=http://notification:4007',
      ].join(','),
    ),
  /// Таймаут бэкенда, мс → 504 при превышении.
  PROXY_TIMEOUT_MS: z.coerce.number().int().min(100).default(15_000),

  // --- Rate-limit (in-memory на MVP, 1.2) -----------------------------------
  /// Базовый лимит на остальной API, запросов в секунду на IP.
  RATE_LIMIT_API: z.coerce.number().int().min(1).default(30),
  /// Жёсткий лимит на /api/auth/**.
  RATE_LIMIT_AUTH: z.coerce.number().int().min(1).default(5),
  RATE_LIMIT_BURST: z.coerce.number().int().min(1).default(60),
});

export type GatewayEnv = BaseEnv & z.infer<typeof GatewayEnvSchema>;

export function loadGatewayEnv(source: NodeJS.ProcessEnv = process.env): GatewayEnv {
  return loadEnv(GatewayEnvSchema.shape, source);
}

let cached: GatewayEnv | null = null;

/** Ленивая загрузка окружения (fail-fast при первом обращении, обычно на старте). */
export function getGatewayEnv(): GatewayEnv {
  cached ??= loadGatewayEnv();
  return cached;
}

/** Адреса сервисов: { catalog: 'http://catalog:4002', … }. */
export function parseServiceUrls(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const [name, url] = pair.split('=').map((part) => part.trim());
    if (name && url) result[name] = url;
  }
  return result;
}

/** Ожидаемые аудитории токена (client_id через запятую). */
export function parseAudiences(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Роли из env (через запятую) → известные порталу роли; мусор отбрасывается. */
export function parseRoles(raw: string): Role[] {
  return raw
    .split(',')
    .map((part) => part.trim().toUpperCase())
    .filter((part): part is Role => (ROLES as readonly string[]).includes(part));
}
