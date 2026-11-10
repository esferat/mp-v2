import { Body, Controller, Inject, Param, Put } from '@nestjs/common';
import { type UpdateDoctorRequest, updateDoctorSchema } from '@mp/contracts';
import type { DoctorListItem } from '../../../entities/doctor';
import { type DoctorContext } from '../../../entities/doctor';
import type { SpecializationRepository } from '../../../entities/specialization';
import { SPECIALIZATION_REPOSITORY } from '../../../entities/specialization';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../entities/repository';
import { ZodPipe } from '../../../shared/lib';
import { updateDoctor } from '../app/update-doctor';

/** Адаптер входа: id из пути -> Zod-валидация тела -> use-case (3.2). */
@Controller('api/catalog/doctors')
export class UpdateDoctorController {
  constructor(
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWork<DoctorContext>,
    @Inject(SPECIALIZATION_REPOSITORY)
    private readonly specializations: SpecializationRepository,
  ) {}

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(updateDoctorSchema)) body: UpdateDoctorRequest,
  ): Promise<DoctorListItem> {
    return updateDoctor(this.unitOfWork, this.specializations, id, body);
  }
}
