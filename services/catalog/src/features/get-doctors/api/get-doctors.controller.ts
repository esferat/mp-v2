import { Controller, Get, Inject, Query } from '@nestjs/common';
import { doctorListQuerySchema, type DoctorListResponse } from '@mp/contracts';
import {
  DOCTOR_REPOSITORY,
  type DoctorListQuery,
  type DoctorRepository,
  PHOTO_URL_SIGNER,
  type PhotoUrlSigner,
} from '../../../entities/doctor';
import { ZodPipe } from '../../../shared/lib';
import { getDoctors } from '../app/get-doctors';

/**
 * Адаптер входа (fsd.md §4.2): Zod-валидация query (offset/limit/search/status)
 * → use-case. Только ADMIN через gateway (политика 1.2; сервис дополнительно
 * проверяет роль при прямом обращении — защита в глубину).
 */
@Controller('api/catalog/doctors')
export class GetDoctorsController {
  constructor(
    @Inject(DOCTOR_REPOSITORY)
    private readonly repository: DoctorRepository,
    @Inject(PHOTO_URL_SIGNER)
    private readonly signer: PhotoUrlSigner,
  ) {}

  @Get()
  list(
    @Query(new ZodPipe(doctorListQuerySchema)) query: DoctorListQuery,
  ): Promise<DoctorListResponse> {
    return getDoctors(this.repository, this.signer, query);
  }
}
