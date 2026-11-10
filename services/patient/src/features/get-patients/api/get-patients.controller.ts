import { Controller, Get, Inject, Query } from '@nestjs/common';
import {
  type PatientListQuery,
  patientListQuerySchema,
  type PatientListResponse,
} from '@mp/contracts';
import type { PatientRepository, PhotoUrlSigner } from '../../../entities/patient';
import { PATIENT_REPOSITORY, PHOTO_URL_SIGNER } from '../../../entities/patient';
import { ZodPipe } from '../../../shared/lib';
import { getPatients } from '../app/get-patients';

/** Адаптер входа (4.1): список с поиском/пагинацией; доступ ADMIN/DOCTOR через gateway. */
@Controller('api/patients')
export class GetPatientsController {
  constructor(
    @Inject(PATIENT_REPOSITORY)
    private readonly repository: PatientRepository,
    @Inject(PHOTO_URL_SIGNER)
    private readonly signer: PhotoUrlSigner | undefined,
  ) {}

  @Get()
  list(
    @Query(new ZodPipe(patientListQuerySchema)) query: PatientListQuery,
  ): Promise<PatientListResponse> {
    return getPatients(this.repository, this.signer, query);
  }
}
