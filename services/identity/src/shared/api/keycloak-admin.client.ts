import type { Logger } from '@mp/service-kit';
import {
  EmailExistsError,
  type NewUser,
  type UserDirectory,
  type UserProfileData,
} from '../../entities/registration';
import type { IdentityEnv } from '../config';
import { ClientCredentialsTokenCache } from './token-cache';

/**
 * Адаптер Keycloak Admin API (hexagonal: реализация порта UserDirectory).
 *
 * Аутентификация — client credentials сервисного аккаунта `svc-identity`
 * (manage-users), токен кэшируется общим ClientCredentialsTokenCache —
 * им же пользуются service-to-service вызовы (identity → patient).
 * В логи НИКОГДА не попадают пароль пользователя и access-токен (1.4 AC).
 */
export class KeycloakAdminClient implements UserDirectory {
  constructor(
    private readonly env: IdentityEnv,
    private readonly log: Logger,
    private readonly tokens: ClientCredentialsTokenCache,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async findByEmail(email: string): Promise<string | null> {
    const url = new URL(
      `${this.env.KEYCLOAK_INTERNAL_URL}/admin/realms/${this.env.KEYCLOAK_REALM}/users`,
    );
    url.searchParams.set('email', email);
    url.searchParams.set('exact', 'true');

    const response = await this.request(url, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Keycloak admin users: HTTP ${response.status}`);
    }

    const users = (await response.json()) as Array<{ id?: string }>;
    const [first] = users;
    return first?.id ?? null;
  }

  async createUser(user: NewUser): Promise<string> {
    const url = `${this.env.KEYCLOAK_INTERNAL_URL}/admin/realms/${this.env.KEYCLOAK_REALM}/users`;
    const response = await this.request(new URL(url), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: user.email.toLowerCase(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        enabled: true,
        emailVerified: false,
        attributes: {
          ...(user.birthDate ? { birthDate: [user.birthDate] } : {}),
          ...(user.middleName ? { middleName: [user.middleName] } : {}),
        },
        // Пароль — только в этом теле запроса; в логи и ответы не попадает
        credentials: [{ type: 'password', value: user.password, temporary: false }],
      }),
    });

    if (response.status === 409) {
      throw new EmailExistsError(user.email);
    }
    if (!response.ok) {
      throw new Error(`Keycloak admin create user: HTTP ${response.status}`);
    }

    const location = response.headers.get('location') ?? '';
    const userId = location.split('/').filter(Boolean).pop();
    if (!userId) {
      throw new Error('Keycloak не вернул Location созданного пользователя');
    }

    await this.assignUserRole(userId, user.realmRole ?? 'USER');
    this.log.debug({ userId, role: user.realmRole ?? 'USER' }, 'пользователь Keycloak создан');
    return userId;
  }

  async deleteUser(userId: string): Promise<void> {
    // Компенсация best-effort с ретраями (1.4): сбой компенсации не должен
    // скрывать основную ошибку — только логируется.
    const url = `${this.env.KEYCLOAK_INTERNAL_URL}/admin/realms/${this.env.KEYCLOAK_REALM}/users/${userId}`;
    const delays = [200, 500, 1000];

    for (const [index, delay] of delays.entries()) {
      try {
        const response = await this.request(new URL(url), { method: 'DELETE' });
        if (response.ok || response.status === 404) {
          this.log.warn({ userId }, 'компенсация: пользователь Keycloak удалён');
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        if (index === delays.length - 1) {
          this.log.error(
            { userId, err: error },
            'компенсация НЕ удалась: пользователь остался в Keycloak (ручной разбор)',
          );
          return;
        }
        await sleep(delay);
      }
    }
  }

  async findProfile(userId: string): Promise<UserProfileData | null> {
    const user = await this.fetchUser(userId);
    if (!user || !user.email) return null;
    return {
      email: user.email,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
    };
  }

  async updateProfile(
    userId: string,
    patch: { email?: string; firstName?: string; lastName?: string },
  ): Promise<UserProfileData> {
    const current = await this.fetchUser(userId);
    if (!current) {
      throw new Error(`Пользователь ${userId} не найден в Keycloak`);
    }

    const currentEmail = current.email ?? '';
    if (!currentEmail && !patch.email) {
      throw new Error(`У пользователя ${userId} не задан email`);
    }
    const nextEmail = patch.email?.trim() || currentEmail;
    if (nextEmail !== currentEmail) {
      // Единая проверка уникальности (10.1): источник истины — Keycloak
      const taken = await this.findByEmail(nextEmail);
      if (taken && taken !== userId) throw new EmailExistsError(nextEmail);
    }

    const nextFirstName = patch.firstName ?? current.firstName ?? '';
    const nextLastName = patch.lastName ?? current.lastName ?? '';

    const url = new URL(
      `${this.env.KEYCLOAK_INTERNAL_URL}/admin/realms/${this.env.KEYCLOAK_REALM}/users/${userId}`,
    );
    const response = await this.request(url, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        // NB: username НЕ меняем — Keycloak 26 отвечает 400 на смену username
        // через Admin API. Логин по новому email работает: loginWithEmailAllowed
        // включён в realm (проверено), username остаётся прежним.
        username: current.username ?? nextEmail,
        email: nextEmail,
        firstName: nextFirstName,
        lastName: nextLastName,
        enabled: current.enabled ?? true,
        emailVerified: current.emailVerified ?? true,
        ...(current.attributes ? { attributes: current.attributes } : {}),
      }),
    });

    // Keycloak сам отвечает 409 при занятом username/email (гонка с другим запросом)
    if (response.status === 409) throw new EmailExistsError(nextEmail);
    if (!response.ok) {
      throw new Error(`Keycloak admin update user: HTTP ${response.status}`);
    }

    this.log.debug({ userId, emailChanged: nextEmail !== currentEmail }, 'профиль обновлён');
    return {
      email: nextEmail,
      firstName: nextFirstName,
      lastName: nextLastName,
    };
  }

  /** Пользователь Keycloak по id (= sub из токена); null — не найден. */
  private async fetchUser(userId: string): Promise<{
    username?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    enabled?: boolean;
    emailVerified?: boolean;
    attributes?: Record<string, string[]>;
  } | null> {
    const url = new URL(
      `${this.env.KEYCLOAK_INTERNAL_URL}/admin/realms/${this.env.KEYCLOAK_REALM}/users/${userId}`,
    );
    const response = await this.request(url, { method: 'GET' });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Keycloak admin user: HTTP ${response.status}`);
    }
    return (await response.json()) as {
      username?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      enabled?: boolean;
      emailVerified?: boolean;
      attributes?: Record<string, string[]>;
    };
  }

  /**
   * Назначение realm-роли (идемпотентно: повторное назначение — no-op).
   * NB: Keycloak 26 ищет роль по **id** — с одним name отвечает 404
   * «Role not found», поэтому сначала читаем роль по имени.
   */
  private async assignUserRole(
    userId: string,
    roleName: 'USER' | 'DOCTOR' = 'USER',
  ): Promise<void> {
    const realmAdmin = `${this.env.KEYCLOAK_INTERNAL_URL}/admin/realms/${this.env.KEYCLOAK_REALM}`;

    const roleResp = await this.request(new URL(`${realmAdmin}/roles/${roleName}`), {
      method: 'GET',
    });
    if (!roleResp.ok) {
      throw new Error(`Keycloak role ${roleName} не найден: HTTP ${roleResp.status}`);
    }
    const role = (await roleResp.json()) as { id: string; name: string };

    const response = await this.request(
      new URL(`${realmAdmin}/users/${userId}/role-mappings/realm`),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify([{ id: role.id, name: role.name }]),
      },
    );
    if (!response.ok) {
      throw new Error(`Keycloak role-mappings: HTTP ${response.status}`);
    }
  }

  /** Запрос admin API с bearer-токеном сервисного аккаунта (кэшируется). */
  private async request(url: URL, init: RequestInit): Promise<Response> {
    const accessToken = await this.tokens.getToken();
    return this.fetchImpl(url, {
      ...init,
      signal: AbortSignal.timeout(10_000),
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        authorization: `Bearer ${accessToken}`,
      },
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
