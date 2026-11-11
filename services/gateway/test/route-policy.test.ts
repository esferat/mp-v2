import { describe, expect, it } from 'vitest';
import { allowsRoles, findPolicy, ROUTE_POLICIES } from '../src/entities/authorization';

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

  it('карточка врача (:id) читается всеми ролями, список — только ADMIN (5.2)', () => {
    const card = findPolicy('GET', '/api/catalog/doctors/cmw123abc');
    expect(card?.path).toBe('/api/catalog/doctors/:id');
    expect(allowsRoles(card, ['USER'])).toBe(true);

    const list = findPolicy('GET', '/api/catalog/doctors');
    expect(list?.path).toBe('/api/catalog/doctors');
    expect(allowsRoles(list, ['USER'])).toBe(false);
    expect(allowsRoles(list, ['ADMIN'])).toBe(true);
  });

  it('неизвестный маршрут → undefined (любой авторизованный)', () => {
    expect(findPolicy('GET', '/api/anything/else')).toBeUndefined();
  });

  it('реестр не пуст и покрывает админские зоны', () => {
    expect(ROUTE_POLICIES.length).toBeGreaterThan(5);
    expect(findPolicy('GET', '/api/reports/visits')?.roles).toEqual(['ADMIN']);
    expect(findPolicy('PUT', '/api/scheduling/appointments/1/status')?.roles).toContain('ADMIN');
  });

  // 0.9: scrape Prometheus ходит на /metrics без токена
  it('метрики процесса публичны (scrape без токена)', () => {
    expect(findPolicy('GET', '/metrics')?.roles).toBeNull();
    expect(allowsRoles(findPolicy('GET', '/metrics'), [])).toBe(true);
  });

  // TD-02 (9.1 AC): расписание врача — 403 обязан выдать и gateway, и сервис
  it('расписание врача — только DOCTOR/ADMIN, USER не проходит', () => {
    const list = findPolicy('GET', '/api/scheduling/appointments/doctor');
    const patients = findPolicy('GET', '/api/scheduling/appointments/doctor/patients');

    expect(list?.roles).toEqual(['DOCTOR', 'ADMIN']);
    expect(patients?.roles).toEqual(['DOCTOR', 'ADMIN']);
    expect(allowsRoles(list, ['USER'])).toBe(false);
    expect(allowsRoles(list, ['DOCTOR'])).toBe(true);
    expect(allowsRoles(list, ['ADMIN'])).toBe(true);
  });

  it('список всех записей — только ADMIN; своя история /me — любая роль', () => {
    // 1.2/5.4: сервис прав на список не проверяет — рубеж на шлюзе
    expect(findPolicy('GET', '/api/scheduling/appointments')?.roles).toEqual(['ADMIN']);
    expect(allowsRoles(findPolicy('GET', '/api/scheduling/appointments'), ['USER'])).toBe(false);
    // 5.5: /me не задет ужесточением (patientId берётся из токена)
    expect(findPolicy('GET', '/api/scheduling/appointments/me')?.roles).toEqual([
      'ADMIN',
      'USER',
      'DOCTOR',
    ]);
  });

  it('ужесточение списка не ломает бронь и статусы', () => {
    expect(findPolicy('POST', '/api/scheduling/appointments')?.roles).toEqual([
      'USER',
      'DOCTOR',
      'ADMIN',
    ]);
    expect(findPolicy('PUT', '/api/scheduling/appointments/1/status')?.roles).toEqual([
      'ADMIN',
      'DOCTOR',
    ]);
    expect(findPolicy('PUT', '/api/scheduling/appointments/1/cancel')?.roles).toEqual([
      'ADMIN',
      'DOCTOR',
    ]);
  });

  // 10.3 (Этап 2.1): перенос — только ADMIN; ':id'-политика не перехватывает соседние маршруты
  it('перенос записи — только ADMIN; :id-путь не перехватывает status/cancel', () => {
    const reschedule = findPolicy('PUT', '/api/scheduling/appointments/ap-1/reschedule');
    expect(reschedule?.roles).toEqual(['ADMIN']);
    expect(reschedule?.path).toBe('/api/scheduling/appointments/:id/reschedule');
    expect(allowsRoles(reschedule, ['DOCTOR'])).toBe(false);
    expect(allowsRoles(reschedule, ['ADMIN'])).toBe(true);

    // соседние маршруты остаются на своих политиках (ADMIN, DOCTOR)
    expect(findPolicy('PUT', '/api/scheduling/appointments/ap-1/status')?.roles).toEqual([
      'ADMIN',
      'DOCTOR',
    ]);
    expect(findPolicy('PUT', '/api/scheduling/appointments/ap-1/cancel')?.roles).toEqual([
      'ADMIN',
      'DOCTOR',
    ]);
    // GET списка записей политикой переноса не задет
    expect(findPolicy('GET', '/api/scheduling/appointments')?.roles).toEqual(['ADMIN']);
  });

  // 3.2: профиль пользователя (email врача) — только админ; /me не задет
  it('профиль пользователя по id — только ADMIN; соседний /me открыт своим ролям', () => {
    const get = findPolicy('GET', '/api/identity/users/u-1');
    expect(get?.path).toBe('/api/identity/users');
    expect(get?.roles).toEqual(['ADMIN']);
    expect(allowsRoles(get, ['USER'])).toBe(false);
    expect(allowsRoles(get, ['DOCTOR'])).toBe(false);
    expect(allowsRoles(get, ['ADMIN'])).toBe(true);

    expect(findPolicy('PATCH', '/api/identity/users/u-1')?.roles).toEqual(['ADMIN']);

    // /me не задет ужесточением (профиль и правка своих данных)
    expect(findPolicy('GET', '/api/identity/me')?.roles).toEqual(['ADMIN', 'USER', 'DOCTOR']);
    expect(findPolicy('PATCH', '/api/identity/me')?.roles).toEqual(['ADMIN', 'USER', 'DOCTOR']);
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
