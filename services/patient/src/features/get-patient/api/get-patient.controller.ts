import { Controller, Get, Inject, Param, Req, UnauthorizedException } from '@nestjs/common';
import type { Patient } from '@mp/contracts';
import type { RequestAuth } from '@mp/service-kit';
import {
  PATIENT_REPOSITORY,
  type PatientRepository,
  PHOTO_URL_SIGNER,
  type PhotoUrlSigner,
} from '../../../entities/patient';
import { getPatient, getPatientInternal } from '../app/get-patient';

type AuthedRequest = { auth?: RequestAuth };

/** Адаптер входа: id из пути + claims токена → use-case (4.2). */
@Controller('api/patient')
export class GetPatientController {
  constructor(
    @Inject(PATIENT_REPOSITORY)
    private readonly repository: PatientRepository,
    @Inject(PHOTO_URL_SIGNER)
    private readonly signer: PhotoUrlSigner | undefined,
  ) {}

  @Get(':id')
  get(@Param('id') id: string, @Req() request: AuthedRequest): Promise<Patient> {
    const auth = request.auth;
    if (!auth) {
      throw new UnauthorizedException('Требуется токен доступа');
    }
    return getPatient(this.repository, id, { sub: auth.sub, roles: auth.realmRoles }, this.signer);
  }

  /**
   * Внутренний маршрут (9.3/5.3: scheduling читает карточку для брони
   * админом токеном svc-backend): любой валидный токен реалма, ролевой
   * фильтрации нет. Наружу через gateway закрыт политикой
   * (GET /api/patient/internal → ADMIN/DOCTOR), прямой вызов — только
   * из сети контейнеров (как set-photo, 4.3).
   */
  @Get('internal/:id')
  internal(@Param('id') id: string, @Req() request: AuthedRequest): Promise<Patient> {
    if (!request.auth) {
      throw new UnauthorizedException('Требуется токен доступа');
    }
    return getPatientInternal(this.repository, id);
  }
}
