import { Body, Controller, Get, Inject, Patch, Req, UnauthorizedException } from '@nestjs/common';
import { type MeProfile, type UpdateMeRequest, updateMeSchema } from '@mp/contracts';
import type { RequestAuth } from '@mp/service-kit';
import { USER_DIRECTORY, type UserDirectory } from '../../../entities/registration';
import { ZodPipe } from '../../../shared/lib';
import { getMyProfile, updateMyProfile } from '../app/me';

type AuthedRequest = { auth?: RequestAuth };

/**
 * Адаптер входа (10.1): GET/PATCH /api/identity/me — профиль и правка
 * СВОИХ данных; sub берётся из токена, чужой id в запросе не нужен.
 */
@Controller('api/identity')
export class MeController {
  constructor(
    @Inject(USER_DIRECTORY)
    private readonly directory: UserDirectory,
  ) {}

  @Get('me')
  get(@Req() request: AuthedRequest): Promise<MeProfile> {
    return getMyProfile(this.directory, subjectOf(request));
  }

  @Patch('me')
  update(
    @Body(new ZodPipe(updateMeSchema)) body: UpdateMeRequest,
    @Req() request: AuthedRequest,
  ): Promise<MeProfile> {
    return updateMyProfile(this.directory, subjectOf(request), body);
  }
}

function subjectOf(request: AuthedRequest): { sub: string; roles: string[] } {
  const auth = request.auth;
  if (!auth) throw new UnauthorizedException('Требуется токен доступа');
  return { sub: auth.sub, roles: auth.realmRoles };
}
