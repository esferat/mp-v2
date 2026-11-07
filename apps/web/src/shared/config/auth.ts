import NextAuth from 'next-auth';
import Keycloak from 'next-auth/providers/keycloak';
import { getWebEnv } from './env';
import { msUntilExpiry, refreshAccessToken, resolveRoles, type JwtState } from './auth-callbacks';

/**
 * Конфигурация Auth.js (задача 1.1): Keycloak + PKCE, JWT-стратегия,
 * прозрачный refresh, роли из токена для гардов (1.3) и меню (2.1).
 *
 * Секреты и токены живут только в HttpOnly-куке (AUTH_SECRET подписывает её);
 * в localStorage/DOM и в ответ /api/auth/session не попадают (AC 1.1) —
 * серверный код читает их через getSessionTokens().
 */
const env = getWebEnv();

const keycloak = Keycloak({
  clientId: env.AUTH_KEYCLOAK_ID,
  // Публичный клиент (PKCE): секрет в Keycloak не выдан — пустая строка ок
  clientSecret: env.AUTH_KEYCLOAK_SECRET || undefined,
  issuer: env.AUTH_KEYCLOAK_ISSUER,
  // Endpoints разделены: авторизацию открывает БРАУЗЕР (localhost:8180 —
  // публичный origin), а token/userinfo дёргает СЕРВЕР (keycloak:8080 —
  // localhost из контейнера недоступен). Явные url отключают discovery.
  authorization: {
    url: `${env.AUTH_KEYCLOAK_ISSUER}/protocol/openid-connect/auth`,
  },
  token: {
    url: `${env.AUTH_KEYCLOAK_INTERNAL_URL}/realms/${env.AUTH_KEYCLOAK_REALM}/protocol/openid-connect/token`,
  },
  userinfo: {
    url: `${env.AUTH_KEYCLOAK_INTERNAL_URL}/realms/${env.AUTH_KEYCLOAK_REALM}/protocol/openid-connect/userinfo`,
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.AUTH_SECRET,
  // Host приходит через nginx/прокси — доверяем своему (dev и прод за nginx)
  trustHost: true,
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 часов — рабочая сессия кабинета
  },
  pages: {
    signIn: '/auth/login',
  },
  providers: [keycloak],
  callbacks: {
    /**
     * Первый вход: сохраняем токены и роли из профиля Keycloak.
     * Дальше: прозрачное обновление access_token до истечения (AC 1.1).
     */
    async jwt({ token, account, profile }) {
      const state = token as JwtState;

      if (account && profile) {
        // Явный cast: литерал конструируется из полей account/profile,
        // совместимость с JWT гарантирует augment src/types/next-auth.d.ts.
        // Роли: profile (id_token) или claims access_token — Keycloak
        // кладёт realm_access только в access_token.
        return {
          ...state,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          idToken: account.id_token,
          expiresAt: account.expires_at ? account.expires_at * 1000 : undefined,
          roles: resolveRoles(profile, account.access_token),
          user: {
            sub: profile.sub,
            email: typeof profile.email === 'string' ? profile.email : undefined,
          },
        } as JwtState;
      }

      // До истечения 60 с — пробуем обновить; сбой не роняет сессию.
      // Эндпоинт — ВНУТРЕННИЙ адрес Keycloak: jwt-callback выполняется в
      // контейнере web, где localhost:8180 недоступен (без этого обновление
      // всегда падало и SSR ломался через TTL access_token ~5 мин).
      if (msUntilExpiry(state) < 60_000) {
        return refreshAccessToken(
          state,
          `${env.AUTH_KEYCLOAK_INTERNAL_URL}/realms/${env.AUTH_KEYCLOAK_REALM}`,
          env.AUTH_KEYCLOAK_ID,
          env.AUTH_KEYCLOAK_SECRET,
        );
      }

      return state;
    },

    /**
     * JWT → session: только роли и пользователь. Токены сюда НЕ копируются —
     * Auth.js отдаёт session целиком в GET /api/auth/session (клиенту);
     * для серверного доступа — getSessionTokens() (AC 1.1).
     */
    async session({ session, token }) {
      const state = token as JwtState;
      session.user.roles = state.roles ?? [];
      // sub пациента/врача для серверных загрузок (профиль 4.2, кабинет 9.x)
      if (state.user?.sub) {
        session.user.id = state.user.sub;
      }
      return session;
    },

    /** Отказ/отмена логина → возврат на исходную страницу (callbackUrl). */
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/') || url.startsWith(baseUrl)) return url;
      // Внешние URL (например, после Keycloak logout) — только на свой origin
      try {
        const target = new URL(url, baseUrl);
        if (target.origin === new URL(baseUrl).origin) return target.toString();
      } catch {
        /* падаем в дефолт ниже */
      }
      return baseUrl;
    },
  },
});
