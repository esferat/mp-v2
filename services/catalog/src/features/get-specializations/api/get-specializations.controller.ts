import { Controller, Get, Inject } from '@nestjs/common';
import type { Specialization } from '@mp/contracts';
import {
  SPECIALIZATION_REPOSITORY,
  type SpecializationRepository,
} from '../../../entities/specialization';
import { getSpecializations } from '../app/get-specializations';

/**
 * Адаптер входа (fsd.md §4.2): только DTO-контракт и вызов use-case
 * из того же слайса. Бизнес-логики здесь нет.
 */
@Controller('api/catalog/specializations')
export class GetSpecializationsController {
  constructor(
    @Inject(SPECIALIZATION_REPOSITORY)
    private readonly repository: SpecializationRepository,
  ) {}

  @Get()
  list(): Promise<Specialization[]> {
    return getSpecializations(this.repository);
  }
}
