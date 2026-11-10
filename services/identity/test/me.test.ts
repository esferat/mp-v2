import { describe, expect, it } from 'vitest';
import { getMyProfile, updateMyProfile } from '../src/features/me';
import { ConflictError, NotFoundError } from '../src/shared/model';
import { FakeDirectory } from './helpers/fake-directory';

async function seededDirectory(): Promise<{ directory: FakeDirectory; sub: string }> {
  const directory = new FakeDirectory();
  const sub = await directory.createUser({
    email: 'doctor@test.mp',
    firstName: 'Иван',
    lastName: 'Петров',
  });
  return { directory, sub };
}

/** Профиль текущего пользователя (10.1, Этап 2.1). */
describe('me: профиль и правка своих данных', () => {
  it('getMyProfile: отдаёт email/ФИО и роли из токена', async () => {
    const { directory, sub } = await seededDirectory();
    const profile = await getMyProfile(directory, { sub, roles: ['DOCTOR'] });
    expect(profile).toEqual({
      email: 'doctor@test.mp',
      firstName: 'Иван',
      lastName: 'Петров',
      roles: ['DOCTOR'],
    });
  });

  it('getMyProfile: чужой sub → 404 (профиль только свой)', async () => {
    const { directory } = await seededDirectory();
    await expect(
      getMyProfile(directory, { sub: 'unknown-sub', roles: ['DOCTOR'] }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('updateMyProfile: меняет только переданные поля, логин следует за email', async () => {
    const { directory, sub } = await seededDirectory();
    const updated = await updateMyProfile(
      directory,
      { sub, roles: ['DOCTOR'] },
      { email: 'new@test.mp' },
    );

    expect(updated.email).toBe('new@test.mp');
    expect(updated.firstName).toBe('Иван'); // не передавали — не тронуто
    // username = email (как при регистрации): старый логин освобождён
    expect(await directory.findByEmail('new@test.mp')).toBe(sub);
    expect(await directory.findByEmail('doctor@test.mp')).toBeNull();
  });

  it('updateMyProfile: занятый email → ConflictError с полем email (409)', async () => {
    const { directory, sub } = await seededDirectory();
    await directory.createUser({ email: 'taken@test.mp', firstName: 'X', lastName: 'Y' });

    const error = await updateMyProfile(
      directory,
      { sub, roles: ['USER'] },
      { email: 'taken@test.mp' },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).status).toBe(409);
    expect((error as ConflictError).details?.field).toBe('email');
  });

  it('updateMyProfile: неизвестный sub → 404', async () => {
    const { directory } = await seededDirectory();
    await expect(
      updateMyProfile(directory, { sub: 'unknown-sub', roles: [] }, { firstName: 'Н' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
