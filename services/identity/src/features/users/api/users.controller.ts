import { Body, Controller, Get, Inject, Param, Patch, Req } from '@nestjs/common';
import {
  type AdminUserProfile,
  type UpdateAdminUserProfileRequest,
  updateAdminUserProfileSchema,
} from '@mp/contracts';
import type { RequestAuth } from '@mp/service-kit';
import { USER_DIRECTORY, type UserDirectory } from '../../../entities/registration';
import { requireAdmin, ZodPipe } from '../../../shared/lib';
import { getUserProfile, updateUserProfile } from '../app/users';

/** Запрос с claims из JwtAuthGuard (request.auth, 1.2). */
type AuthedRequest = { auth?: RequestAuth };

/**
 * Адаптер входа (3.2): GET/PATCH /api/identity/users/:userId — профиль
 * пользователя для карточки врача. Только ADMIN (политика шлюза 1.2 +
 * проверка роли здесь — защита в глубину при прямом вызове сервиса).
 */
@Controller('api/identity')
export class UsersController {
  constructor(
    @Inject(USER_DIRECTORY)
    private readonly directory: UserDirectory,
  ) {}

  @Get('users/:userId')
  get(@Param('userId') userId: string, @Req() request: AuthedRequest): Promise<AdminUserProfile> {
    requireAdmin(request.auth);
    return getUserProfile(this.directory, userId);
  }

  @Patch('users/:userId')
  update(
    @Param('userId') userId: string,
    @Body(new ZodPipe(updateAdminUserProfileSchema)) body: UpdateAdminUserProfileRequest,
    @Req() request: AuthedRequest,
  ): Promise<AdminUserProfile> {
    requireAdmin(request.auth);
    return updateUserProfile(this.directory, userId, body);
  }
}
