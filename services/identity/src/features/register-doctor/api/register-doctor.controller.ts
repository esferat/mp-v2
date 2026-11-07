import {
  Body,
  Controller,
  ForbiddenException,
  Inject,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  registerDoctorRequestSchema,
  type RegisterDoctorRequest,
  type RegisterDoctorResponse,
} from '@mp/contracts';
import type { RequestAuth } from '@mp/service-kit';
import { CATALOG_DOCTORS, USER_DIRECTORY } from '../../../entities/registration';
import type { CatalogDoctors, UserDirectory } from '../../../entities/registration';
import { ZodPipe } from '../../../shared/lib';
import { registerDoctor } from '../../../processes/register-doctor-saga';

/** Запрос с claims из JwtAuthGuard (request.auth, 1.2). */
type AuthedRequest = { auth?: RequestAuth };

/**
 * Адаптер входа (9.1): только ADMIN (политика gateway 1.2 + проверка роли
 * здесь — защита в глубину при прямом вызове сервиса).
 */
@Controller('api/identity')
export class RegisterDoctorController {
  constructor(
    @Inject(USER_DIRECTORY)
    private readonly directory: UserDirectory,
    @Inject(CATALOG_DOCTORS)
    private readonly catalog: CatalogDoctors,
  ) {}

  @Post('doctors')
  register(
    @Body(new ZodPipe(registerDoctorRequestSchema)) body: RegisterDoctorRequest,
    @Req() request: AuthedRequest,
  ): Promise<RegisterDoctorResponse> {
    const auth = request.auth;
    if (!auth) {
      throw new UnauthorizedException('Требуется токен доступа');
    }
    if (!auth.realmRoles.includes('ADMIN')) {
      throw new ForbiddenException('Создание врача доступно только администратору');
    }
    return registerDoctor({ directory: this.directory, catalog: this.catalog }, body);
  }
}
