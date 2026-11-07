import { describe, expect, it } from 'vitest';
import { RoutingKeys } from '@mp/contracts';
import { setDoctorPhoto } from '../src/features/set-doctor-photo';
import { makeCatalogContext } from './helpers/in-memory';

const schedule = {
  startTime: '09:00',
  endTime: '18:00',
  durationMinutes: 30,
  workDays: [1, 2, 3, 4, 5],
};

async function seedDoctor() {
  const context = makeCatalogContext();
  const spec = await context.specializations.create('Хирург');
  const doctor = await context.doctors.create({
    firstName: 'Иван',
    lastName: 'Иванов',
    specializationId: spec.id,
    schedule,
  });
  return { context, doctor };
}

describe('setDoctorPhoto (use-case, 3.4)', () => {
  it('привязывает фото, возвращает прежний ключ и публикует doctor.updated.v1', async () => {
    const { context, doctor } = await seedDoctor();

    const first = await setDoctorPhoto(context.unitOfWork, doctor.id, 'a.jpg');
    expect(first).toEqual({ previousKey: null });
    expect((await context.doctors.findById(doctor.id))?.photoKey).toBe('a.jpg');

    const second = await setDoctorPhoto(context.unitOfWork, doctor.id, 'b.jpg');
    expect(second).toEqual({ previousKey: 'a.jpg' });

    const events = context.outbox.events.filter(
      (event) => event.routingKey === RoutingKeys.DoctorUpdated,
    );
    expect(events).toHaveLength(2);
    expect(events[0]?.payload).toMatchObject({
      payload: { doctorId: doctor.id, photoKey: 'a.jpg' },
    });
  });

  it('key = null очищает фото (возврат старого ключа в компенсации)', async () => {
    const { context, doctor } = await seedDoctor();
    await setDoctorPhoto(context.unitOfWork, doctor.id, 'a.jpg');

    const cleared = await setDoctorPhoto(context.unitOfWork, doctor.id, null);

    expect(cleared).toEqual({ previousKey: 'a.jpg' });
    expect((await context.doctors.findById(doctor.id))?.photoKey).toBeUndefined();
  });

  it('неизвестный врач -> 404, событий нет', async () => {
    const { context } = await seedDoctor();

    await expect(setDoctorPhoto(context.unitOfWork, 'no-such', 'a.jpg')).rejects.toMatchObject({
      status: 404,
    });
    expect(context.outbox.events).toHaveLength(0);
  });
});
