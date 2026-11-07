import { handlers } from '@/shared/config/auth';

/**
 * Единый маршрут Auth.js (1.1): /api/auth/* → signin/signout/callback/session.
 * Запрашивает только сервер (SSR/действия) — браузер напрямую в Keycloak
 * ходит только через редирект авторизации.
 */
export const { GET, POST } = handlers;
