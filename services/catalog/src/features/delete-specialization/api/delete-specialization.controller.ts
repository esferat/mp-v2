import { Controller, Delete, Inject, Param } from '@nestjs/common';
import { okSchema } from '@mp/contracts';
import type { UnitOfWork } from '../../../entities/repository';
import { UNIT_OF_WORK } from '../../../entities/repository';
import type { SpecializationContext } from '../../../entities/specialization';
import { deleteSpecialization } from '../app/delete-specialization';

/** Адаптер входа: только вызов use-case слайса. */
@Controller('api/catalog/specializations')
export class DeleteSpecializationController {
  constructor(
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWork<SpecializationContext>,
  ) {}

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ ok: true }> {
    await deleteSpecialization(this.unitOfWork, id);
    return okSchema.parse({ ok: true });
  }
}
