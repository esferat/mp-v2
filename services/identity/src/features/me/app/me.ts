import { type MeProfile, type UpdateMeRequest } from '@mp/contracts';
import { EmailExistsError, type UserDirectory } from '../../../entities/registration';
import { ConflictError, NotFoundError } from '../../../shared/model';

/** Субъект токена (10.1): sub — это id пользователя Keycloak. */
export interface ProfileSubject {
  sub: string;
  roles: readonly string[];
}

/**
 * Профиль текущего пользователя (10.1): email/ФИО — источник истины
 * Keycloak, роли — из токена. Чужой профиль недоступен: id берётся только
 * из sub, в запросе его нет.
 */
export async function getMyProfile(
  directory: UserDirectory,
  subject: ProfileSubject,
): Promise<MeProfile> {
  const profile = await directory.findProfile(subject.sub);
  if (!profile) throw new NotFoundError('Пользователь не найден');
  return { ...profile, roles: [...subject.roles] };
}

/**
 * Правка СВОИХ данных (10.1): только переданные поля. Занятый email →
 * 409 с полем `email` (проверка — единая функция identity, см. port
 * UserDirectory.updateProfile); логин следует за email.
 */
export async function updateMyProfile(
  directory: UserDirectory,
  subject: ProfileSubject,
  patch: UpdateMeRequest,
): Promise<MeProfile> {
  const existing = await directory.findProfile(subject.sub);
  if (!existing) throw new NotFoundError('Пользователь не найден');

  let updated;
  try {
    updated = await directory.updateProfile(subject.sub, patch);
  } catch (error) {
    if (error instanceof EmailExistsError) {
      throw new ConflictError('Email уже зарегистрирован', { field: 'email' });
    }
    throw error;
  }

  return { ...updated, roles: [...subject.roles] };
}
