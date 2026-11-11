import { Body, Controller, Inject, Param, Post, Req } from '@nestjs/common';
import {
  type CreateDoctorAccountRequest,
  type CreateDoctorAccountResponse,
  createDoctorAccountRequestSchema,
} from '@mp/contracts';
import type { RequestAuth } from '@mp/service-kit';
import type { CatalogDoctors, UserDirectory } from '../../../entities/registration';
import { CATALOG_DOCTORS, USER_DIRECTORY } from '../../../entities/registration';
import { requireAdmin, ZodPipe } from '../../../shared/lib';
import { createDoctorAccount } from '../../../processes/register-doctor-saga';

/** Запрос с claims из JwtAuthGuard (request.auth, 1.2). */
type AuthedRequest = { auth?: RequestAuth };

/**
 * Адаптер входа (правило «учётная запись создаётся администратором всегда»):
 * POST /api/identity/doctors/:doctorId/account — сага привязки учётной
 * записи к УЖЕ существующему карточке врача. Только ADMIN (политика
 * шлюза 1.2 + проверка роли здесь — защита в глубину).
 */
@Controller('api/identity')
export class CreateDoctorAccountController {
  constructor(
    @Inject(USER_DIRECTORY)
    private readonly directory: UserDirectory,
    @Inject(CATALOG_DOCTORS)
    private readonly catalog: CatalogDoctors,
  ) {}

  @Post('doctors/:doctorId/account')
  create(
    @Param('doctorId') doctorId: string,
    @Body(new ZodPipe(createDoctorAccountRequestSchema)) body: CreateDoctorAccountRequest,
    @Req() request: AuthedRequest,
  ): Promise<CreateDoctorAccountResponse> {
    requireAdmin(request.auth);
    return createDoctorAccount(
      { directory: this.directory, catalog: this.catalog },
      { doctorId, ...body },
    );
  }
}
