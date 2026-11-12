import { describe, expect, it } from 'vitest';
import { parseSessionCookies } from '../src/shared/config/session-tokens';

/**
 * Разбор кук сессии (AC 1.1 + HTTPS): Auth.js на https://*.mp-kit.local
 * ставит `__Secure-authjs.session-token` — без его распознавания сервер
 * не находит токены и уводит на вход с работающей сессией.
 */
describe('parseSessionCookies', () => {
  it('обычная кука (http): token и salt = имя куки', () => {
    expect(parseSessionCookies([{ name: 'authjs.session-token', value: 'jwt' }])).toEqual({
      token: 'jwt',
      salt: 'authjs.session-token',
    });
  });

  it('HTTPS: __Secure-префикс находится, salt — с префиксом (как у Auth.js)', () => {
    expect(parseSessionCookies([{ name: '__Secure-authjs.session-token', value: 'jwt' }])).toEqual({
      token: 'jwt',
      salt: '__Secure-authjs.session-token',
    });
  });

  it('чанки .N склеиваются по порядку, salt — базовое имя', () => {
    expect(
      parseSessionCookies([
        { name: 'authjs.session-token.1', value: 'BBB' },
        { name: 'authjs.session-token.0', value: 'AAA' },
      ]),
    ).toEqual({ token: 'AAABBB', salt: 'authjs.session-token' });
  });

  it('Secure-чанки: склейка и salt с префиксом', () => {
    expect(
      parseSessionCookies([
        { name: '__Secure-authjs.session-token.1', value: 'BBB' },
        { name: '__Secure-authjs.session-token.0', value: 'AAA' },
      ]),
    ).toEqual({ token: 'AAABBB', salt: '__Secure-authjs.session-token' });
  });

  it('чужие куки игнорируются → null (сессии нет)', () => {
    expect(parseSessionCookies([])).toBeNull();
    expect(parseSessionCookies([{ name: 'other', value: 'x' }])).toBeNull();
    // csrf — соседнее имя, не должно попасть под фильтр
    expect(parseSessionCookies([{ name: '__Secure-authjs.csrf-token', value: 'x' }])).toBeNull();
  });
});
