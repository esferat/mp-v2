import { describe, expect, it } from 'vitest';
import { getUserProfile, updateUserProfile } from '../src/features/users';
import { ConflictError, NotFoundError } from '../src/shared/model';
import { FakeDirectory } from './helpers/fake-directory';

async function seededDirectory(): Promise<{ directory: FakeDirectory; userId: string }> {
  const directory = new FakeDirectory();
  const userId = await directory.createUser({
    email: 'doctor@test.mp',
    firstName: 'Иван',
    lastName: 'Петров',
  });
  return { directory, userId };
}

/** Профиль пользователя для админки (3.2: email врача в карточке). */
describe('users: профиль и правка админом', () => {
  it('getUserProfile: отдаёт userId/email/ФИО из Keycloak', async () => {
    const { directory, userId } = await seededDirectory();
    const profile = await getUserProfile(directory, userId);

    expect(profile).toEqual({
      userId,
      email: 'doctor@test.mp',
      firstName: 'Иван',
      lastName: 'Петров',
    });
  });

  it('getUserProfile: неизвестный id → 404', async () => {
    const { directory } = await seededDirectory();
    await expect(getUserProfile(directory, 'unknown-id')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('updateUserProfile: меняет email, логин следует за ним (как у /me)', async () => {
    const { directory, userId } = await seededDirectory();
    const updated = await updateUserProfile(directory, userId, { email: 'new@test.mp' });

    expect(updated.email).toBe('new@test.mp');
    expect(updated.firstName).toBe('Иван'); // не передавали — не тронуто
    expect(await directory.findByEmail('new@test.mp')).toBe(userId);
    expect(await directory.findByEmail('doctor@test.mp')).toBeNull();
  });

  it('updateUserProfile: занятый email → ConflictError с полем email (409)', async () => {
    const { directory, userId } = await seededDirectory();
    await directory.createUser({ email: 'taken@test.mp', firstName: 'X', lastName: 'Y' });

    const error = await updateUserProfile(directory, userId, { email: 'taken@test.mp' }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).status).toBe(409);
    expect((error as ConflictError).details?.field).toBe('email');
  });

  it('updateUserProfile: неизвестный id → 404 (правка без профиля не проходит)', async () => {
    const { directory } = await seededDirectory();
    await expect(
      updateUserProfile(directory, 'unknown-id', { email: 'new@test.mp' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
