import { describe, expect, it } from 'vitest';
import { RoutingKeys } from '@mp/contracts';
import { createSpecialization } from '../src/features/create-specialization';
import { deleteSpecialization } from '../src/features/delete-specialization';
import { makeContext } from './helpers/in-memory';

describe('deleteSpecialization (use-case)', () => {
  it('удаляет свободную специализацию и публикует событие (0.9)', async () => {
    const { unitOfWork, repository, outbox } = makeContext();
    const created = await createSpecialization(unitOfWork, { name: 'Педиатр' });

    await deleteSpecialization(unitOfWork, created.id);

    expect(await repository.findById(created.id)).toBeNull();
    expect(outbox.events).toHaveLength(2); // create + delete
    expect(outbox.events[1]).toMatchObject({
      routingKey: RoutingKeys.SpecializationChanged,
      payload: { payload: { specId: created.id, name: 'Педиатр' } },
    });
  });

  it('занятую специализацию (есть врачи) удалить нельзя → 409', async () => {
    const { unitOfWork, repository, outbox } = makeContext();
    const created = await createSpecialization(unitOfWork, { name: 'Кардиолог' });
    repository.attachDoctor(created.id, 3);

    await expect(deleteSpecialization(unitOfWork, created.id)).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      details: { doctorsCount: 3 },
    });

    expect(await repository.findById(created.id)).not.toBeNull();
    expect(outbox.events).toHaveLength(1); // событие delete не записано
  });

  it('несуществующая специализация → 404', async () => {
    const { unitOfWork } = makeContext();

    await expect(deleteSpecialization(unitOfWork, 'missing-id')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });
});
