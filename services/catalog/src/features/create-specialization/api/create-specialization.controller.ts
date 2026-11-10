import { Body, Controller, Inject, Post } from '@nestjs/common';
import {
  type CreateSpecializationRequest,
  createSpecializationSchema,
  type Specialization,
} from '@mp/contracts';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../entities/repository';
import type { SpecializationContext } from '../../../entities/specialization';
import { ZodPipe } from '../../../shared/lib';
import { createSpecialization } from '../app/create-specialization';

/** Адаптер входа: Zod-валидация контракта → use-case слайса. */
@Controller('api/catalog/specializations')
export class CreateSpecializationController {
  constructor(
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWork<SpecializationContext>,
  ) {}

  @Post()
  create(
    @Body(new ZodPipe(createSpecializationSchema)) body: CreateSpecializationRequest,
  ): Promise<Specialization> {
    return createSpecialization(this.unitOfWork, body);
  }
}
