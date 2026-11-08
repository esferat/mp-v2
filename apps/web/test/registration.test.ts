import { describe, expect, it } from 'vitest';
import {
  requestOrigin,
  safeCallbackPath,
  withRegisterAction,
} from '../src/shared/lib/registration';

describe('safeCallbackPath (1.1: защита от open redirect)', () => {
  it('принимает относительные пути', () => {
    expect(safeCallbackPath('/admin/doctors')).toBe('/admin/doctors');
    expect(safeCallbackPath('/')).toBe('/');
  });

  it('отклоняет абсолютные и протокольно-относительные URL', () => {
    expect(safeCallbackPath('https://evil.com/phish')).toBe('/');
    expect(safeCallbackPath('//evil.com/phish')).toBe('/');
    expect(safeCallbackPath(null)).toBe('/');
    expect(safeCallbackPath(undefined)).toBe('/');
    expect(safeCallbackPath('')).toBe('/');
  });
});

describe('requestOrigin (абсолютные URL за nginx/прокси)', () => {
  it('берёт внешний origin из x-forwarded-host', () => {
    const headers = new Headers({
      'x-forwarded-host': 'portal.mp-kit.local',
      'x-forwarded-proto': 'https',
      host: 'web:3000',
    });
    expect(requestOrigin(headers)).toBe('https://portal.mp-kit.local');
  });

  it('иначе использует host запроса', () => {
    expect(requestOrigin(new Headers({ host: 'localhost:8080' }))).toBe('http://localhost:8080');
  });

  it('падает на дефолт, если хоста нет (request.url в контейнере = 0.0.0.0)', () => {
    expect(requestOrigin(new Headers())).toBe('http://localhost:3000');
  });
});

describe('withRegisterAction (глубокая ссылка на регистрацию)', () => {
  it('дописывает пометку, сохраняя state/PKCE параметры', () => {
    const authUrl =
      'http://localhost:8180/realms/medical-portal/protocol/openid-connect/auth' +
      '?client_id=next-web&response_type=code&state=abc&code_challenge=xyz';
    const out = withRegisterAction(authUrl);
    const url = new URL(out);

    expect(url.searchParams.get('mp_action')).toBe('register');
    // state и PKCE — обязательны для callback Auth.js после регистрации
    expect(url.searchParams.get('state')).toBe('abc');
    expect(url.searchParams.get('code_challenge')).toBe('xyz');
    expect(url.pathname).toBe('/realms/medical-portal/protocol/openid-connect/auth');
  });

  it('заменяет уже существующую пометку, а не дублирует её', () => {
    const url = new URL(withRegisterAction(withRegisterAction('http://kc/auth?state=a')));
    expect(url.searchParams.getAll('mp_action')).toEqual(['register']);
  });
});
