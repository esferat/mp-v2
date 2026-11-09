import { describe, expect, it } from 'vitest';
import { HttpException } from '@nestjs/common';
import {
  AUTH_OPTIONS,
  AuthModule,
  JwtAuthGuard,
  isPublicPath,
  type RequestAuth,
} from '../src/auth/auth.module';
import { TokenInvalidError, matchesAudience } from '../src/auth/jwks-verifier';

/** Фейковый верификатор: токен 'good' проходит, остальные — нет. */
const fakeVerifier = {
  async verify(token: string): Promise<RequestAuth> {
    if (token === 'Bearer good') {
      return {
        sub: 'u-1',
        realmRoles: ['ADMIN'],
        issuer: 'test',
        expiresAt: new Date('2030-01-01'),
      };
    }
    throw new TokenInvalidError('Токен просрочен', 'TOKEN_EXPIRED');
  },
};

function makeContext(url: string, authorization?: string) {
  const request = {
    method: 'GET',
    url,
    headers: authorization ? { authorization } : {},
  };
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

describe('isPublicPath (1.2: health всегда, префиксы сервиса)', () => {
  it('health-эндпоинты публичны всегда', () => {
    expect(isPublicPath('/healthz', undefined)).toBe(true);
    expect(isPublicPath('/readyz', [])).toBe(true);
    // scrape Prometheus ходит без токена (0.9)
    expect(isPublicPath('/metrics', undefined)).toBe(true);
  });

  it('префиксы из AUTH_PUBLIC_PATHS', () => {
    expect(isPublicPath('/api/identity/register', ['/api/identity/register'])).toBe(true);
    expect(isPublicPath('/api/identity/other', ['/api/identity/register'])).toBe(false);
    expect(isPublicPath('/api/catalog/doctors', ['/api/identity/register'])).toBe(false);
  });
});

describe('JwtAuthGuard (защита в глубину, AC 1.2)', () => {
  const guard = new JwtAuthGuard(fakeVerifier, {
    publicPaths: ['/api/identity/register'],
  });

  it('public-маршрут проходит без токена', async () => {
    await expect(guard.canActivate(makeContext('/api/identity/register'))).resolves.toBe(true);
    await expect(guard.canActivate(makeContext('/healthz'))).resolves.toBe(true);
    await expect(guard.canActivate(makeContext('/readyz'))).resolves.toBe(true);
  });

  it('без токена на защищённом маршруте → 401 TOKEN_MISSING', async () => {
    try {
      await guard.canActivate(makeContext('/api/catalog/doctors'));
      expect.unreachable('ожидался 401');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(401);
      expect((error as HttpException).getResponse()).toMatchObject({
        code: 'TOKEN_MISSING',
      });
    }
  });

  it('просроченный токен → 401 с кодом верификатора', async () => {
    try {
      await guard.canActivate(makeContext('/api/catalog/doctors', 'Bearer expired'));
      expect.unreachable('ожидался 401');
    } catch (error) {
      expect((error as HttpException).getResponse()).toMatchObject({
        code: 'TOKEN_EXPIRED',
      });
    }
  });

  it('валидный токен → true, auth кладётся в запрос', async () => {
    const context = makeContext('/api/catalog/doctors', 'Bearer good');
    await expect(guard.canActivate(context)).resolves.toBe(true);
    const request = context.switchToHttp().getRequest<{ auth?: RequestAuth }>();
    expect(request.auth?.sub).toBe('u-1');
    expect(request.auth?.realmRoles).toEqual(['ADMIN']);
  });
});

describe('matchesAudience (семантика Keycloak: aud или azp)', () => {
  const options = { issuer: 'iss', audiences: ['next-web', 'svc-e2e'] };

  it('aud массив → пересечение', () => {
    expect(matchesAudience({ aud: ['next-web', 'x'] }, options.audiences)).toBe(true);
    expect(matchesAudience({ aud: ['other'] }, options.audiences)).toBe(false);
  });

  it('password-grant: aud нет, есть azp', () => {
    expect(matchesAudience({ azp: 'svc-e2e' }, options.audiences)).toBe(true);
    expect(matchesAudience({ azp: 'unknown' }, options.audiences)).toBe(false);
  });

  it('нет ни aud, ни azp → отказ', () => {
    expect(matchesAudience({}, options.audiences)).toBe(false);
  });
});

describe('AuthModule.forRoot', () => {
  it('создаёт динамический глобальный модуль с провайдами', () => {
    const dynamic = AuthModule.forRoot({ publicPaths: ['/x'] });
    expect(dynamic.global).toBe(true);
    expect(dynamic.providers).toHaveLength(2);
    // Экспорты — DI-токены (символы), а не строки
    expect(dynamic.exports).toHaveLength(2);
    expect(dynamic.exports).toContain(AUTH_OPTIONS);
  });
});
