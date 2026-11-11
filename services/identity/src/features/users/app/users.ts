import type { AdminUserProfile, UpdateAdminUserProfileRequest } from '@mp/contracts';
import { EmailExistsError, type UserDirectory } from '../../../entities/registration';
import { ConflictError, NotFoundError } from '../../../shared/model';

/**
 * Профиль пользователя по id для админки (3.2: email врача в карточке).
 * Источник истины — Keycloak (как у /me); право ADMIN проверяется на шлюзе
 * и в контроллере (защита в глубину), здесь — только домен.
 */
export async function getUserProfile(
  directory: UserDirectory,
  userId: string,
): Promise<AdminUserProfile> {
  const profile = await directory.findProfile(userId);
  if (!profile) throw new NotFoundError('Пользователь не найден');
  return { userId, ...profile };
}

/**
 * Правка профиля пользователя админом. Здесь — только email (ФИО врача
 * правится в карточке каталога — один источник на каждое поле). Занятый
 * email → 409 с полем `email` (проверка — единая функция identity).
 */
export async function updateUserProfile(
  directory: UserDirectory,
  userId: string,
  patch: UpdateAdminUserProfileRequest,
): Promise<AdminUserProfile> {
  const existing = await directory.findProfile(userId);
  if (!existing) throw new NotFoundError('Пользователь не найден');

  try {
    const updated = await directory.updateProfile(userId, patch);
    return { userId, ...updated };
  } catch (error) {
    if (error instanceof EmailExistsError) {
      throw new ConflictError('Email уже зарегистрирован', { field: 'email' });
    }
    throw error;
  }
}
