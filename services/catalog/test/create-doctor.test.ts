import { describe, expect, it } from 'vitest';
import { RoutingKeys } from '@mp/contracts';
import { createDoctor } from '../src/features/create-doctor';
import { makeCatalogContext } from './helpers/in-memory';

const schedule = {
  startTime: '09:00',
  endTime: '18:00',
  durationMinutes: 30,
  workDays: [1, 2, 3, 4, 5],
};

describe('createDoctor (use-case, 3.2)', () => {
  it('создаёт врача и пишет doctor.created.v1 в одной транзакции (3.5)', async () => {
    const { unitOfWork, specializations, doctors, outbox } = makeCatalogContext();
    const spec = await specializations.create('Хирург');

    const created = await createDoctor(unitOfWork, specializations, {
      firstName: 'Иван',
      lastName: 'Иванов',
      middleName: 'Иванович',
      specializationId: spec.id,
      schedule,
    });

    expect(created).toMatchObject({
      firstName: 'Иван',
      lastName: 'Иванов',
      middleName: 'Иванович',
      specializationName: 'Хирург',
      status: 'ACTIVE',
      schedule,
    });
    expect(await doctors.findById(created.id)).not.toBeNull();

    expect(outbox.events).toHaveLength(1);
    expect(outbox.events[0]?.routingKey).toBe(RoutingKeys.DoctorCreated);
    expect(outbox.events[0]?.payload).toMatchObject({
      eventId: expect.any(String),
      payload: {
        doctorId: created.id,
        firstName: 'Иван',
        lastName: 'Иванов',
        specializationName: 'Хирург',
        schedule,
      },
    });
  });

  it('нечётный период -> ValidationError 400 с полем schedule.durationMinutes', async () => {
    const { unitOfWork, specializations, outbox } = makeCatalogContext();
    const spec = await specializations.create('Хирург');

    await expect(
      createDoctor(unitOfWork, specializations, {
        firstName: 'Иван',
        lastName: 'Иванов',
        specializationId: spec.id,
        schedule: { ...schedule, endTime: '18:15' },
      }),
    ).rejects.toMatchObject({ status: 400, field: 'schedule.durationMinutes' });

    expect(outbox.events).toHaveLength(0);
  });

  it('начало позже конца -> ValidationError 400 с полем schedule.startTime', async () => {
    const { unitOfWork, specializations } = makeCatalogContext();
    const spec = await specializations.create('Хирург');

    await expect(
      createDoctor(unitOfWork, specializations, {
        firstName: 'Иван',
        lastName: 'Иванов',
        specializationId: spec.id,
        schedule: { ...schedule, startTime: '20:00', endTime: '08:00' },
      }),
    ).rejects.toMatchObject({ status: 400, field: 'schedule.startTime' });
  });

  it('неизвестная специализация -> 400 specializationId (не FK-500)', async () => {
    const { unitOfWork, specializations, outbox } = makeCatalogContext();

    await expect(
      createDoctor(unitOfWork, specializations, {
        firstName: 'Иван',
        lastName: 'Иванов',
        specializationId: 'no-such-spec',
        schedule,
      }),
    ).rejects.toMatchObject({ status: 400, field: 'specializationId' });

    expect(outbox.events).toHaveLength(0);
  });
});
