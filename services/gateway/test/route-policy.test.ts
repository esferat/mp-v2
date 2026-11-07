import { describe, expect, it } from 'vitest';
import { ROUTE_POLICIES, allowsRoles, findPolicy } from '../src/entities/authorization';

describe('findPolicy', () => {
  it('находит публичный маршрут /api/auth', () => {
    const policy = findPolicy('POST', '/api/auth/register');
    expect(policy?.roles).toBeNull();
  });

  it('самое длинное совпадение префикса выигрывает', () => {
    const policy = findPolicy('GET', '/api/catalog/specializations');
    expect(policy?.path).toBe('/api/catalog/specializations');
    expect(policy?.roles).toContain('USER');
  });

  it('общий префикс /api/catalog ловит неописанные пути (ADMIN)', () => {
    const policy = findPolicy('GET', '/api/catalog/whatever');
    expect(policy?.path).toBe('/api/catalog');
    expect(policy?.roles).toEqual(['ADMIN']);
  });

  it('учитывает метод: DELETE специализации — ADMIN, GET — все роли', () => {
    expect(findPolicy('DELETE', '/api/catalog/specializations')?.roles).toEqual(['ADMIN']);
    expect(findPolicy('GET', '/api/catalog/specializations')?.roles).toEqual([
      'ADMIN',
      'USER',
      'DOCTOR',
    ]);
  });

  it('неизвестный маршрут → undefined (любой авторизованный)', () => {
    expect(findPolicy('GET', '/api/anything/else')).toBeUndefined();
  });

  it('реестр не пуст и покрывает админские зоны', () => {
    expect(ROUTE_POLICIES.length).toBeGreaterThan(5);
    expect(findPolicy('GET', '/api/reports/visits')?.roles).toEqual(['ADMIN']);
    expect(findPolicy('PUT', '/api/scheduling/appointments/1/status')?.roles).toContain('ADMIN');
  });
});

describe('allowsRoles', () => {
  it('null (публичный) → всегда разрешено', () => {
    expect(allowsRoles({ path: '/api/auth', roles: null }, [])).toBe(true);
  });

  it('пустой список ролей → любой авторизованный', () => {
    expect(allowsRoles({ path: '/x', roles: [] }, [])).toBe(true);
  });

  it('нужна хотя бы одна из ролей (OR)', () => {
    const policy = { path: '/x', roles: ['ADMIN', 'DOCTOR'] as const };
    expect(allowsRoles({ ...policy, roles: [...policy.roles] }, ['DOCTOR'])).toBe(true);
    expect(allowsRoles({ ...policy, roles: [...policy.roles] }, ['USER'])).toBe(false);
    expect(allowsRoles({ ...policy, roles: [...policy.roles] }, [])).toBe(false);
  });
});
