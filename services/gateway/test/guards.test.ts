import { describe, expect, it } from 'vitest';
import { type ExecutionContext, HttpException } from '@nestjs/common';
import { JwtAuthGuard } from '../src/features/authenticate';
import { RolesGuard } from '../src/features/authorize';
import {
  type TokenClaims,
  TokenInvalidError,
  type TokenVerifier,
} from '../src/entities/authorization';

/** Заглушка ExecutionContext: только метод/путь/заголовки/claims. */
function makeContext(
  method: string,
  url: string,
  headers: Record<string, string> = {},
  claims?: TokenClaims,
): ExecutionContext {
  const request = { method, url, headers, ...(claims ? { claims } : {}) };
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const adminClaims: TokenClaims = {
  sub: 'u-1',
  roles: ['ADMIN'],
  issuer: 'http://localhost:8180/realms/medical-portal',
  expiresAt: new Date('2030-01-01'),
};

class FakeVerifier implements TokenVerifier {
  async verify(bearer: string): Promise<TokenClaims> {
    if (bearer.includes('expired')) {
      throw new TokenInvalidError('Токен просрочен', 'TOKEN_EXPIRED');
    }
    if (bearer.includes('admin')) return adminClaims;
    return { ...adminClaims, sub: 'u-2', roles: ['USER'] };
  }
}

async function expectHttpError(
  promise: Promise<unknown>,
  status: number,
  code: string,
): Promise<void> {
  try {
    await promise;
    expect.unreachable('ожидалось исключение');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    const ex = error as HttpException;
    expect(ex.getStatus()).toBe(status);
    expect(ex.getResponse()).toMatchObject({ code });
  }
}

describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard(new FakeVerifier());

  it('публичный маршрут (/api/auth) проходит без токена', async () => {
    await expect(guard.canActivate(makeContext('POST', '/api/auth/register'))).resolves.toBe(true);
  });

  it('без токена на защищённом маршруте → 401 UNAUTHORIZED', async () => {
    await expectHttpError(
      guard.canActivate(makeContext('GET', '/api/catalog/doctors')),
      401,
      'UNAUTHORIZED',
    );
  });

  it('невалидный токен → 401 с кодом из верификатора', async () => {
    await expectHttpError(
      guard.canActivate(
        makeContext('GET', '/api/catalog/doctors', { authorization: 'Bearer expired' }),
      ),
      401,
      'TOKEN_EXPIRED',
    );
  });

  it('валидный токен → true, claims записаны в запрос', async () => {
    const context = makeContext('GET', '/api/catalog/doctors', {
      authorization: 'Bearer admin-token',
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    const request = context.switchToHttp().getRequest<{ claims?: TokenClaims }>();
    expect(request.claims?.sub).toBe('u-1');
    expect(request.claims?.roles).toEqual(['ADMIN']);
  });
});

describe('RolesGuard', () => {
  const guard = new RolesGuard();

  it('ADMIN на админском маршруте → true', () => {
    expect(guard.canActivate(makeContext('GET', '/api/catalog/doctors', {}, adminClaims))).toBe(
      true,
    );
  });

  it('USER на админском маршруте → 403 FORBIDDEN (AC 1.2)', () => {
    expect(() =>
      guard.canActivate(
        makeContext('GET', '/api/catalog/doctors', {}, { ...adminClaims, roles: ['USER'] }),
      ),
    ).toThrow(expect.objectContaining({ status: 403 }) as unknown as Error);
  });

  it('DOCTOR на админском маршруте → 403', () => {
    expect(() =>
      guard.canActivate(
        makeContext('GET', '/api/catalog/doctors', {}, { ...adminClaims, roles: ['DOCTOR'] }),
      ),
    ).toThrow();
  });

  it('публичный и неописанный маршруты пропускаются без ролей', () => {
    expect(guard.canActivate(makeContext('POST', '/api/auth/register'))).toBe(true);
    expect(guard.canActivate(makeContext('GET', '/api/unknown/path'))).toBe(true);
  });
});
