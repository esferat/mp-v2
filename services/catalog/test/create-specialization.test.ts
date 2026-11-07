import { describe, expect, it } from 'vitest';
import { RoutingKeys } from '@mp/contracts';
import { createSpecialization } from '../src/features/create-specialization';
import { getSpecializations } from '../src/features/get-specializations';
import { makeContext } from './helpers/in-memory';

describe('getSpecializations (use-case)', () => {
  it('возвращает пустой список, пока нет специализаций', async () => {
    const { repository } = makeContext();

    await expect(getSpecializations(repository)).resolves.toEqual([]);
  });

  it('возвращает все специализации с числом врачей, отсортированные', async () => {
    const { repository } = makeContext();
    await repository.create('Хирург');
    const therapist = await repository.create('Терапевт');
    repository.attachDoctor(therapist.id, 2);

    const result = await getSpecializations(repository);

    expect(result.map((s) => s.name)).toEqual(['Терапевт', 'Хирург']);
    expect(result[0]?.doctorsCount).toBe(2);
    expect(result[1]?.doctorsCount).toBe(0);
  });
});

describe('createSpecialization (use-case)', () => {
  it('создаёт специализацию и пишет событие в outbox (0.9)', async () => {
    const { unitOfWork, repository, outbox } = makeContext();

    const created = await createSpecialization(unitOfWork, { name: '  Кардиолог  ' });

    expect(created).toMatchObject({ name: 'Кардиолог', doctorsCount: 0 });
    expect(await repository.findByName('кардиолог')).not.toBeNull();

    expect(outbox.events).toHaveLength(1);
    expect(outbox.events[0]?.routingKey).toBe(RoutingKeys.SpecializationChanged);
    expect(outbox.events[0]?.payload).toMatchObject({
      eventId: expect.any(String),
      occurredAt: expect.any(String),
      payload: { specId: created.id, name: 'Кардиолог' },
    });
  });

  it('нормализует имя: схлопывает пробелы и обрезает', async () => {
    const { unitOfWork } = makeContext();

    const created = await createSpecialization(unitOfWork, {
      name: '  Невро   лог  ',
    });

    expect(created.name).toBe('Невро лог');
  });

  it('дубликат (без учёта регистра) → ConflictError и ни одного события', async () => {
    const { unitOfWork, outbox } = makeContext();
    await createSpecialization(unitOfWork, { name: 'Хирург' });

    await expect(createSpecialization(unitOfWork, { name: '  хирург ' })).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
    });

    expect(outbox.events).toHaveLength(1); // только от первой записи
  });

  it('слишком короткое имя → ValidationError (400) с указанием поля', async () => {
    const { unitOfWork, outbox } = makeContext();

    await expect(createSpecialization(unitOfWork, { name: 'A' })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      field: 'name',
    });

    expect(outbox.events).toHaveLength(0);
  });
});
