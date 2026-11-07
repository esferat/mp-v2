import { RoutingKeys } from '@mp/contracts';
import { createEvent } from '@mp/service-kit';
import {
  normalizeSpecializationName,
  type Specialization,
  type SpecializationContext,
} from '../../../entities/specialization';
import { type UnitOfWork } from '../../../entities/repository';
import { ConflictError } from '../../../shared/model';

export interface CreateSpecializationCommand {
  name: string;
}

/**
 * Создание специализации (3.3): валидация имени → проверка дубликата →
 * запись и событие specialization.changed.v1 В ОДНОЙ транзакции (outbox, 0.9).
 */
export async function createSpecialization(
  unitOfWork: UnitOfWork<SpecializationContext>,
  command: CreateSpecializationCommand,
): Promise<Specialization> {
  const name = normalizeSpecializationName(command.name);

  return unitOfWork.run(async (context) => {
    const existing = await context.specializations.findByName(name);
    if (existing) {
      throw new ConflictError(`Специализация «${name}» уже существует`, { field: 'name' });
    }

    const created = await context.specializations.create(name);

    await context.outbox.enqueue(
      RoutingKeys.SpecializationChanged,
      createEvent({ specId: created.id, name: created.name }),
    );

    return created;
  });
}
