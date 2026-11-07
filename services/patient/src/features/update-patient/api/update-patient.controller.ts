import { Body, Controller, Inject, Param, Put, Req, UnauthorizedException } from '@nestjs/common';
import type { Patient, UpdatePatientRequest } from '@mp/contracts';
import { updatePatientRequestSchema } from '@mp/contracts';
import type { RequestAuth } from '@mp/service-kit';
import type { PatientContext } from '../../../entities/patient';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../entities/repository';
import { ZodPipe } from '../../../shared/lib';
import { updatePatient } from '../app/update-patient';

type AuthedRequest = { auth?: RequestAuth };

/** Адаптер входа (4.2): id из пути + сверка с телом + claims токена. */
@Controller('api/patient')
export class UpdatePatientController {
  constructor(
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWork<PatientContext>,
  ) {}

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(updatePatientRequestSchema)) body: UpdatePatientRequest,
    @Req() request: AuthedRequest,
  ): Promise<Patient> {
    const auth = request.auth;
    if (!auth) {
      throw new UnauthorizedException('Требуется токен доступа');
    }
    return updatePatient(this.unitOfWork, id, body, {
      sub: auth.sub,
      roles: auth.realmRoles,
    });
  }
}
