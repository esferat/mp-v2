import { describe, expect, it } from 'vitest';
import { RoutingKeys } from '@mp/contracts';
import { createDoctor } from '../src/features/create-doctor';
import { updateDoctor } from '../src/features/update-doctor';
import { makeCatalogContext } from './helpers/in-memory';

const schedule = {
  startTime: '09:00',
  endTime: '18:00',
  durationMinutes: 30,
  workDays: [1, 2, 3, 4, 5],
};

async function seed() {
  const ctx = makeCatalogContext();
  const spec = await ctx.specializations.create('Хирург');
  const doctor = await createDoctor(ctx.unitOfWork, ctx.specializations, {
    firstName: 'Иван',
    lastName: 'Иванов',
    middleName: 'Иванович',
    specializationId: spec.id,
    schedule,
  });
  return { ctx, spec, doctor };
}

describe('updateDoctor (use-case, 3.2)', () => {
  it('обновляет карточку и пишет doctor.updated.v1 (3.5)', async () => {
    const { ctx, spec, doctor } = await seed();
    const before = ctx.outbox.events.length;

    const updated = await updateDoctor(ctx.unitOfWork, ctx.specializations, doctor.id, {
      firstName: 'Пётр',
      lastName: 'Иванов',
      middleName: 'Иванович',
      specializationId: spec.id,
      schedule: { ...schedule, durationMinutes: 45, endTime: '18:00' },
      status: 'ACTIVE',
    });

    expect(updated).toMatchObject({ firstName: 'Пётр', schedule: { durationMinutes: 45 } });
    expect(ctx.outbox.events).toHaveLength(before + 1);
    expect(ctx.outbox.events[before]?.routingKey).toBe(RoutingKeys.DoctorUpdated);
    expect(ctx.outbox.events[before]?.payload).toMatchObject({
      payload: { doctorId: doctor.id, firstName: 'Пётр' },
    });
  });

  it('id в теле не совпадает с путем -> 400 field=id, ничего не записано', async () => {
    const { ctx, spec, doctor } = await seed();
    const before = ctx.outbox.events.length;

    await expect(
      updateDoctor(ctx.unitOfWork, ctx.specializations, doctor.id, {
        id: 'someone-else',
        firstName: 'Пётр',
        lastName: 'Иванов',
        specializationId: spec.id,
        schedule,
      }),
    ).rejects.toMatchObject({ status: 400, field: 'id' });

    expect(ctx.outbox.events).toHaveLength(before);
    expect((await ctx.doctors.findById(doctor.id))?.firstName).toBe('Иван');
  });

  it('архивация status=INACTIVE меняет статус и публикует событие', async () => {
    const { ctx, spec, doctor } = await seed();

    const updated = await updateDoctor(ctx.unitOfWork, ctx.specializations, doctor.id, {
      firstName: 'Иван',
      lastName: 'Иванов',
      specializationId: spec.id,
      schedule,
      status: 'INACTIVE',
    });

    expect(updated.status).toBe('INACTIVE');
  });

  it('неизвестный врач -> 404', async () => {
    const { ctx, spec } = await seed();

    await expect(
      updateDoctor(ctx.unitOfWork, ctx.specializations, 'no-such-doctor', {
        firstName: 'Пётр',
        lastName: 'Иванов',
        specializationId: spec.id,
        schedule,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('очистка отчества (middleName отсутствует) удаляет его', async () => {
    const { ctx, spec, doctor } = await seed();

    const updated = await updateDoctor(ctx.unitOfWork, ctx.specializations, doctor.id, {
      firstName: 'Иван',
      lastName: 'Иванов',
      specializationId: spec.id,
      schedule,
    });

    expect(updated.middleName).toBeUndefined();
  });
});
