import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  type AdminUserProfile,
  type UpdateAdminUserProfileRequest,
  updateAdminUserProfileSchema,
} from '@mp/contracts';
import type { RequestAuth } from '@mp/service-kit';
import { USER_DIRECTORY, type UserDirectory } from '../../../entities/registration';
import { ZodPipe } from '../../../shared/lib';
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
    requireAdmin(request);
    return getUserProfile(this.directory, userId);
  }

  @Patch('users/:userId')
  update(
    @Param('userId') userId: string,
    @Body(new ZodPipe(updateAdminUserProfileSchema)) body: UpdateAdminUserProfileRequest,
    @Req() request: AuthedRequest,
  ): Promise<AdminUserProfile> {
    requireAdmin(request);
    return updateUserProfile(this.directory, userId, body);
  }
}

function requireAdmin(request: AuthedRequest): void {
  const auth = request.auth;
  if (!auth) throw new UnauthorizedException('Требуется токен доступа');
  if (!auth.realmRoles.includes('ADMIN')) {
    throw new ForbiddenException('Профиль пользователя доступен только администратору');
  }
}
