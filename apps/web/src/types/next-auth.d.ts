import type { SessionRole } from '@/shared/config/auth-callbacks';

/**
 * Модульное расширение типов Auth.js (1.1): роли и токены в session/JWT.
 * Файл подхватывается TypeScript автоматически (включён в tsconfig).
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      email?: string | null;
      name?: string | null;
      /** Роли из токена Keycloak (гарды 1.3, меню 2.1). */
      roles: SessionRole[];
    };
    // NB: accessToken/idToken сюда не выносятся — Auth.js отдаёт session
    // в GET /api/auth/session клиенту; токены читает getSessionTokens() (AC 1.1).
  }

  interface User {
    roles?: SessionRole[];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
    /** epoch, мс. */
    expiresAt?: number;
    roles?: SessionRole[];
    user?: { sub?: string; email?: string };
    error?: 'RefreshAccessTokenError';
  }
}

export {};
