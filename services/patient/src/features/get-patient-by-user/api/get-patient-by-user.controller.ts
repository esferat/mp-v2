import { Controller, Get, Inject, Param } from '@nestjs/common';
import type { Patient } from '@mp/contracts';
import {
  PATIENT_REPOSITORY,
  type PatientRepository,
  PHOTO_URL_SIGNER,
  type PhotoUrlSigner,
} from '../../../entities/patient';
import { getPatientByUser } from '../app/get-patient-by-user';

/** Адаптер входа: только вызов use-case слайса (404 — через ApiErrorFilter). */
@Controller('api/patient')
export class GetPatientByUserController {
  constructor(
    @Inject(PATIENT_REPOSITORY)
    private readonly repository: PatientRepository,
    @Inject(PHOTO_URL_SIGNER)
    private readonly signer: PhotoUrlSigner | undefined,
  ) {}

  @Get('by-user/:userId')
  byUser(@Param('userId') userId: string): Promise<Patient> {
    return getPatientByUser(this.repository, userId, this.signer);
  }
}
