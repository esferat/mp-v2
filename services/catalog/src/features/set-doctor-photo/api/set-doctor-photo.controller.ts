import { Body, Controller, Inject, Param, Put } from '@nestjs/common';
import { type SetPhotoRequest, setPhotoRequestSchema, type SetPhotoResponse } from '@mp/contracts';
import { type DoctorContext } from '../../../entities/doctor';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../entities/repository';
import { ZodPipe } from '../../../shared/lib';
import { setDoctorPhoto } from '../app/set-doctor-photo';

/**
 * Адаптер входа (3.4): внутренний маршрут file → catalog.
 * Доступ: валидный токен (в т.ч. svc-file); наружу не экспонируется.
 */
@Controller('api/catalog/doctors')
export class SetDoctorPhotoController {
  constructor(
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWork<DoctorContext>,
  ) {}

  @Put(':id/photo')
  set(
    @Param('id') id: string,
    @Body(new ZodPipe(setPhotoRequestSchema)) body: SetPhotoRequest,
  ): Promise<SetPhotoResponse> {
    return setDoctorPhoto(this.unitOfWork, id, body.key);
  }
}
