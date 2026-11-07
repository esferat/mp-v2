import { RoutingKeys } from '@mp/contracts';
import { createEvent } from '@mp/service-kit';
import { type SpecializationContext } from '../../../entities/specialization';
import { type UnitOfWork } from '../../../entities/repository';
import { ConflictError, NotFoundError } from '../../../shared/model';

/**
 * Удаление специализации (3.3): занятую (есть врачи) удалить нельзя — 409
 * с числом врачей; свободная удаляется вместе с событием в outbox (0.9).
 */
export async function deleteSpecialization(
  unitOfWork: UnitOfWork<SpecializationContext>,
  specializationId: string,
): Promise<void> {
  await unitOfWork.run(async (context) => {
    const specialization = await context.specializations.findById(specializationId);

    if (!specialization) {
      throw new NotFoundError(`Специализация ${specializationId} не найдена`);
    }

    if (specialization.doctorsCount > 0) {
      throw new ConflictError(
        `Нельзя удалить: специализацией пользуются ${specialization.doctorsCount} врачей`,
        { doctorsCount: specialization.doctorsCount },
      );
    }

    await context.specializations.delete(specialization.id);

    await context.outbox.enqueue(
      RoutingKeys.SpecializationChanged,
      createEvent({ specId: specialization.id, name: specialization.name }),
    );
  });
}
