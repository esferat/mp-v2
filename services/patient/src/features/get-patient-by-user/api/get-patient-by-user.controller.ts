import { Controller, Get, Inject, Param } from '@nestjs/common';
import type { Patient } from '@mp/contracts';
import { PATIENT_REPOSITORY } from '../../../entities/patient';
import type { PatientRepository } from '../../../entities/patient';
import { getPatientByUser } from '../app/get-patient-by-user';

/** Адаптер входа: только вызов use-case слайса (404 — через ApiErrorFilter). */
@Controller('api/patient')
export class GetPatientByUserController {
  constructor(
    @Inject(PATIENT_REPOSITORY)
    private readonly repository: PatientRepository,
  ) {}

  @Get('by-user/:userId')
  byUser(@Param('userId') userId: string): Promise<Patient> {
    return getPatientByUser(this.repository, userId);
  }
}
