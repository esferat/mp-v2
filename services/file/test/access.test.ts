import { describe, expect, it } from 'vitest';
import { type AccessSubject, checkFileAccess } from '../src/entities/access';
import { InMemoryAccess } from './helpers/in-memory';

const ADMIN: AccessSubject = { sub: 'admin-1', roles: ['ADMIN'] };
const OWNER: AccessSubject = { sub: 'user-1', roles: ['USER'] };
const OTHER_USER: AccessSubject = { sub: 'user-2', roles: ['USER'] };
const DOCTOR: AccessSubject = { sub: 'doc-user-1', roles: ['DOCTOR'] };

function accessWithOwner(): InMemoryAccess {
  const access = new InMemoryAccess();
  access.patients.set('user-1', 'patient-1');
  return access;
}

describe('checkFileAccess (единая проверка прав, 4.4/4.5)', () => {
  it('ADMIN получает доступ к файлам любого владельца', async () => {
    const access = accessWithOwner();
    await expect(
      checkFileAccess(access, ADMIN, { ownerType: 'PATIENT', ownerId: 'patient-1' }),
    ).resolves.toEqual({ allowed: true });
    await expect(
      checkFileAccess(access, ADMIN, { ownerType: 'DOCTOR', ownerId: 'doctor-1' }),
    ).resolves.toEqual({ allowed: true });
  });

  it('владелец (USER + своя карточка) получает доступ', async () => {
    const access = accessWithOwner();
    await expect(
      checkFileAccess(access, OWNER, { ownerType: 'PATIENT', ownerId: 'patient-1' }),
    ).resolves.toEqual({ allowed: true });
  });

  it('чужая карточка пациента -> отказ с причиной', async () => {
    const access = accessWithOwner();
    access.patients.set('user-2', 'patient-2');
    const result = await checkFileAccess(access, OTHER_USER, {
      ownerType: 'PATIENT',
      ownerId: 'patient-1',
    });
    expect(result).toMatchObject({ allowed: false });
    if (!result.allowed) expect(result.reason).toContain('чужая карточка');
  });

  it('пользователь без карточки -> отказ', async () => {
    const access = new InMemoryAccess();
    const result = await checkFileAccess(access, OWNER, {
      ownerType: 'PATIENT',
      ownerId: 'patient-1',
    });
    expect(result).toMatchObject({ allowed: false });
  });

  it('DOCTOR без связи с пациентом -> отказ (9.3: только действующий приём)', async () => {
    const access = accessWithOwner();
    const result = await checkFileAccess(access, DOCTOR, {
      ownerType: 'PATIENT',
      ownerId: 'patient-1',
    });
    expect(result).toMatchObject({ allowed: false });
    if (!result.allowed) expect(result.reason).toContain('нет действующей записи');
  });

  it('DOCTOR с действующей связью -> доступ к документам пациента (9.3)', async () => {
    const access = accessWithOwner();
    access.relations.add('doc-user-1|patient-1');
    await expect(
      checkFileAccess(access, DOCTOR, { ownerType: 'PATIENT', ownerId: 'patient-1' }),
    ).resolves.toEqual({ allowed: true });

    // чужой пациент -> отказ (связи нет)
    await expect(
      checkFileAccess(access, DOCTOR, { ownerType: 'PATIENT', ownerId: 'patient-OTHER' }),
    ).resolves.toMatchObject({ allowed: false });
  });

  it('потеря связи (запись отменена) закрывает доступ: следующий запрос -> отказ (AC 9.3)', async () => {
    const access = accessWithOwner();
    access.relations.add('doc-user-1|patient-1');
    await expect(
      checkFileAccess(access, DOCTOR, { ownerType: 'PATIENT', ownerId: 'patient-1' }),
    ).resolves.toEqual({ allowed: true });

    // «Отмена записи» в тесте = связь больше не действует
    access.relations.delete('doc-user-1|patient-1');
    const after = await checkFileAccess(access, DOCTOR, {
      ownerType: 'PATIENT',
      ownerId: 'patient-1',
    });
    expect(after).toMatchObject({ allowed: false });
  });

  it('DOCTOR видит СВОИ файлы (привязка sub -> doctorId), чужие -> отказ (9.3)', async () => {
    const access = accessWithOwner();
    access.doctors.set('doc-user-1', 'doctor-1');

    await expect(
      checkFileAccess(access, DOCTOR, { ownerType: 'DOCTOR', ownerId: 'doctor-1' }),
    ).resolves.toEqual({ allowed: true });

    await expect(
      checkFileAccess(access, DOCTOR, { ownerType: 'DOCTOR', ownerId: 'doctor-OTHER' }),
    ).resolves.toMatchObject({ allowed: false });
  });

  it('файлы врача без привязки sub (нет в копии) -> только админ', async () => {
    const access = accessWithOwner();
    const result = await checkFileAccess(access, DOCTOR, {
      ownerType: 'DOCTOR',
      ownerId: 'doctor-1',
    });
    expect(result).toMatchObject({ allowed: false });
  });
});
