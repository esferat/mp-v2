import { Body, Controller, Inject, Post } from '@nestjs/common';
import { type CreateDoctorRequest, createDoctorSchema } from '@mp/contracts';
import type { DoctorListItem } from '../../../entities/doctor';
import { type DoctorContext } from '../../../entities/doctor';
import type { SpecializationRepository } from '../../../entities/specialization';
import { SPECIALIZATION_REPOSITORY } from '../../../entities/specialization';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../entities/repository';
import { ZodPipe } from '../../../shared/lib';
import { createDoctor } from '../app/create-doctor';

/** Адаптер входа: Zod-валидация формы (0.6) -> доменная валидация -> use-case (3.2). */
@Controller('api/catalog/doctors')
export class CreateDoctorController {
  constructor(
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWork<DoctorContext>,
    @Inject(SPECIALIZATION_REPOSITORY)
    private readonly specializations: SpecializationRepository,
  ) {}

  @Post()
  create(
    @Body(new ZodPipe(createDoctorSchema)) body: CreateDoctorRequest,
  ): Promise<DoctorListItem> {
    return createDoctor(this.unitOfWork, this.specializations, body);
  }
}
