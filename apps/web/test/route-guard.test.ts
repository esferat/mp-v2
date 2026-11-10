import { describe, expect, it } from 'vitest';
import {
  decideAccess,
  homeRedirectFor,
  isGuestOnlyPath,
  requiredRoleFor,
} from '../src/shared/lib/route-guard';

/**
 * Unit-тесты гарда (AC 1.3): каждый сегмент — гость, своя роль, чужая роль.
 * Это та же логика, что выполняет src/proxy.ts (там только редиректы).
 */
describe('requiredRoleFor', () => {
  it('карта сегментов соответствует functional-spec 1.3', () => {
    expect(requiredRoleFor('/admin/doctors')).toBe('ADMIN');
    expect(requiredRoleFor('/cabinet/record')).toBe('USER');
    expect(requiredRoleFor('/doctor/schedule')).toBe('DOCTOR');
    expect(requiredRoleFor('/admin')).toBe('ADMIN'); // без слэша
    expect(requiredRoleFor('/')).toBeNull();
    expect(requiredRoleFor('/auth/login')).toBeNull();
    expect(requiredRoleFor('/adminx')).toBeNull(); // не префикс
  });
});

describe('decideAccess: гость (нет сессии)', () => {
  it('защищённый сегмент → login с callbackUrl (AC: редирект с возвратом)', () => {
    expect(decideAccess('/admin/doctors', null)).toEqual({
      type: 'login',
      callbackUrl: '/admin/doctors',
    });
    expect(decideAccess('/cabinet/record', null)).toEqual({
      type: 'login',
      callbackUrl: '/cabinet/record',
    });
    expect(decideAccess('/doctor/schedule', null)).toEqual({
      type: 'login',
      callbackUrl: '/doctor/schedule',
    });
  });

  it('/auth/* гостю разрешён', () => {
    expect(decideAccess('/auth/login', null)).toEqual({ type: 'allow' });
    expect(decideAccess('/auth/register', null)).toEqual({ type: 'allow' });
  });

  it('публичные страницы разрешены', () => {
    expect(decideAccess('/', null)).toEqual({ type: 'allow' });
    expect(decideAccess('/any-page', null)).toEqual({ type: 'allow' });
  });
});

describe('decideAccess: своя роль', () => {
  it('ADMIN проходит в /admin, но не в чужие зоны (роль не «пропуск»)', () => {
    expect(decideAccess('/admin/doctors', ['ADMIN'])).toEqual({ type: 'allow' });
    // /cabinet под ADMIN требует роли USER — АДМИН получит 403 этой зоны,
    // управление пациентами идёт через /admin/**
    expect(decideAccess('/cabinet/record', ['ADMIN'])).toEqual({
      type: 'forbidden',
      required: 'USER',
    });
  });

  it('USER проходит в /cabinet', () => {
    expect(decideAccess('/cabinet/profile', ['USER'])).toEqual({ type: 'allow' });
  });

  it('DOCTOR проходит в /doctor', () => {
    expect(decideAccess('/doctor/patients', ['DOCTOR'])).toEqual({ type: 'allow' });
  });
});

describe('decideAccess: чужая роль → 403 (AC 1.3)', () => {
  it('USER на /admin/doctors → forbidden (контент не отдаётся)', () => {
    expect(decideAccess('/admin/doctors', ['USER'])).toEqual({
      type: 'forbidden',
      required: 'ADMIN',
    });
  });

  it('DOCTOR на /admin/* → forbidden', () => {
    expect(decideAccess('/admin/patients', ['DOCTOR'])).toEqual({
      type: 'forbidden',
      required: 'ADMIN',
    });
  });

  it('USER на /doctor/schedule → forbidden', () => {
    expect(decideAccess('/doctor/schedule', ['USER'])).toEqual({
      type: 'forbidden',
      required: 'DOCTOR',
    });
  });

  it('пользователь без ролей → 403 во всех защищённых зонах', () => {
    expect(decideAccess('/admin/doctors', [])).toMatchObject({ type: 'forbidden' });
    expect(decideAccess('/cabinet/record', [])).toMatchObject({ type: 'forbidden' });
    expect(decideAccess('/doctor/schedule', [])).toMatchObject({ type: 'forbidden' });
  });
});

describe('decideAccess: авторизован на /auth/*', () => {
  it('→ home (некуда входить повторно)', () => {
    expect(decideAccess('/auth/login', ['USER'])).toEqual({ type: 'home' });
    expect(decideAccess('/auth/register', ['USER'])).toEqual({ type: 'home' });
  });
});

describe('isGuestOnlyPath', () => {
  it('распознаёт /auth и его вложенность', () => {
    expect(isGuestOnlyPath('/auth')).toBe(true);
    expect(isGuestOnlyPath('/auth/login')).toBe(true);
    expect(isGuestOnlyPath('/authx')).toBe(false);
    expect(isGuestOnlyPath('/cabinet')).toBe(false);
  });
});

describe('homeRedirectFor (1.4: домашняя страница после входа)', () => {
  it('админ попадает в администрирование', () => {
    expect(homeRedirectFor(['ADMIN'])).toBe('/admin/doctors');
    expect(homeRedirectFor(['ADMIN', 'DOCTOR'])).toBe('/admin/doctors');
  });

  it('врач (без админки) попадает в кабинет врача', () => {
    expect(homeRedirectFor(['DOCTOR'])).toBe('/doctor/schedule');
    expect(homeRedirectFor(['USER', 'DOCTOR'])).toBe('/doctor/schedule');
  });

  it('пациент попадает в личный кабинет (с боковым меню и профилем)', () => {
    expect(homeRedirectFor(['USER'])).toBe('/cabinet/profile');
  });

  it('гость остаётся на агрегированной главной', () => {
    expect(homeRedirectFor([])).toBeNull();
  });
});
