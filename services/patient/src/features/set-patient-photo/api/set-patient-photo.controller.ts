import { Body, Controller, Inject, Param, Put } from '@nestjs/common';
import { type SetPhotoRequest, setPhotoRequestSchema, type SetPhotoResponse } from '@mp/contracts';
import { PATIENT_REPOSITORY, type PatientRepository } from '../../../entities/patient';
import { ZodPipe } from '../../../shared/lib';
import { setPatientPhoto } from '../app/set-patient-photo';

/**
 * Адаптер входа (4.3): внутренний маршрут file → patient.
 * Доступ: любой сервисный/валидный токен (JwtAuthGuard, аудиорус svc-file),
 * за пределами контейнеров маршрут не экспонируется (nginx → gateway).
 */
@Controller('api/patient')
export class SetPatientPhotoController {
  constructor(
    @Inject(PATIENT_REPOSITORY)
    private readonly repository: PatientRepository,
  ) {}

  @Put(':id/photo')
  set(
    @Param('id') id: string,
    @Body(new ZodPipe(setPhotoRequestSchema)) body: SetPhotoRequest,
  ): Promise<SetPhotoResponse> {
    return setPatientPhoto(this.repository, id, body.key);
  }
}
