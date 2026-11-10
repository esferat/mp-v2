import { describe, expect, it } from 'vitest';
import {
  extractRoles,
  type JwtState,
  msUntilExpiry,
  refreshAccessToken,
  resolveRoles,
} from '../src/shared/config/auth-callbacks';

const issuer = 'http://localhost:8180/realms/medical-portal';

/** Фейковый JWT: payload кодируется в base64url, подпись не проверяется. */
function fakeJwt(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  const base64 = Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `eyJhbGciOiJub25lIn0.${base64}.sig`;
}

describe('extractRoles (1.1: роли из токена для гардов)', () => {
  it('оставляет только известные порталу роли', () => {
    expect(
      extractRoles({
        realm_access: { roles: ['ADMIN', 'offline_access', 'USER', 'uma_authorization'] },
      }),
    ).toEqual(['ADMIN', 'USER']);
  });

  it('нет realm_access → пусто (не ошибка)', () => {
    expect(extractRoles(undefined)).toEqual([]);
    expect(extractRoles({})).toEqual([]);
    expect(extractRoles({ realm_access: { roles: 'nope' } })).toEqual([]);
  });
});

describe('resolveRoles (Keycloak: realm_access только в access_token)', () => {
  it('роли в profile (id_token) — берём их', () => {
    expect(
      resolveRoles(
        { realm_access: { roles: ['USER'] } },
        fakeJwt({ realm_access: { roles: ['ADMIN'] } }),
      ),
    ).toEqual(['USER']);
  });

  it('в id_token нет realm_access → читаем claims access_token', () => {
    const accessToken = fakeJwt({ realm_access: { roles: ['ADMIN', 'offline_access'] } });
    expect(resolveRoles({ email: 'a@b.c' }, accessToken)).toEqual(['ADMIN']);
  });

  it('ни там, ни там нет ролей → пусто', () => {
    expect(resolveRoles({}, fakeJwt({ sub: 'x' }))).toEqual([]);
    expect(resolveRoles(undefined, 'не-jwt')).toEqual([]);
    expect(resolveRoles(undefined, undefined)).toEqual([]);
  });
});

describe('msUntilExpiry', () => {
  it('считает остаток и ловит истёкший токен', () => {
    const token: JwtState = { expiresAt: 1_000_000 };
    expect(msUntilExpiry(token, 999_000)).toBe(1_000);
    expect(msUntilExpiry(token, 1_000_100)).toBe(-100);
    expect(msUntilExpiry({}, 1)).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe('refreshAccessToken (1.1: прозрачный refresh)', () => {
  const base: JwtState = {
    accessToken: 'old',
    refreshToken: 'refresh-1',
    expiresAt: Date.now(),
    roles: ['USER'],
  };

  it('успех: новые токены, expiresAt пересчитан, roles сохранены', async () => {
    const fetchImpl = (async (_url: unknown, init?: { body?: unknown }) => {
      // client_secret для публичного клиента (PKCE) НЕ отправляется
      const body = String(init?.body ?? '');
      expect(body).toContain('grant_type=refresh_token');
      expect(body).toContain('refresh_token=refresh-1');
      expect(body).not.toContain('client_secret');

      return new Response(
        JSON.stringify({
          access_token: 'new',
          refresh_token: 'refresh-2',
          id_token: 'id-2',
          expires_in: 300,
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const refreshed = await refreshAccessToken(base, issuer, 'next-web', '', fetchImpl);

    expect(refreshed).toMatchObject({
      accessToken: 'new',
      refreshToken: 'refresh-2',
      idToken: 'id-2',
      roles: ['USER'],
    });
    expect(refreshed.expiresAt).toBeGreaterThan(Date.now() + 250_000);
    expect(refreshed.error).toBeUndefined();
  });

  it('нет refresh_token → ошибка RefreshAccessTokenError, сессия не роняется', async () => {
    const refreshed = await refreshAccessToken(
      { accessToken: 'x' },
      issuer,
      'id',
      '',
      fetchImplNever,
    );
    expect(refreshed.error).toBe('RefreshAccessTokenError');
    expect(refreshed.accessToken).toBe('x');
  });

  it('Keycloak недоступен → ошибка, токены прежние (повтор при следующем тике)', async () => {
    const failing = (async () => {
      throw new Error('ECONNREFUSED');
    }) as typeof fetch;

    const refreshed = await refreshAccessToken(base, issuer, 'next-web', '', failing);
    expect(refreshed.error).toBe('RefreshAccessTokenError');
    expect(refreshed.accessToken).toBe('old');
    expect(refreshed.roles).toEqual(['USER']);
  });

  it('HTTP 400 (просроченный refresh) → ошибка', async () => {
    const rejected = (async () => new Response('bad', { status: 400 })) as typeof fetch;
    const refreshed = await refreshAccessToken(base, issuer, 'next-web', '', rejected);
    expect(refreshed.error).toBe('RefreshAccessTokenError');
  });
});

const fetchImplNever = (async () => {
  throw new Error('не должен вызываться');
}) as typeof fetch;
