import { describe, expect, it } from 'vitest';
import { RoutingKeys } from '@mp/contracts';
import { createDoctor } from '../src/features/create-doctor';
import { linkDoctorUser } from '../src/features/link-doctor-user';
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

/**
 * Привязка учётной записи к существующему врачу (правило «учётную запись
 * создаёт администратор всегда» — шаг B саги identity).
 */
describe('linkDoctorUser (use-case)', () => {
  it('привязывает userId к карточке и пишет doctor.updated.v1', async () => {
    const { ctx, doctor } = await seed();
    const before = ctx.outbox.events.length;

    const linked = await linkDoctorUser(ctx.unitOfWork, doctor.id, { userId: 'kc-1' });

    expect(linked.userId).toBe('kc-1');
    expect((await ctx.doctors.findById(doctor.id))?.userId).toBe('kc-1');
    expect(ctx.outbox.events).toHaveLength(before + 1);
    expect(ctx.outbox.events[before]?.routingKey).toBe(RoutingKeys.DoctorUpdated);
    expect(ctx.outbox.events[before]?.payload).toMatchObject({
      payload: { doctorId: doctor.id, userId: 'kc-1' },
    });
  });

  it('повтор с тем же userId — идемпотентен (без нового события)', async () => {
    const { ctx, doctor } = await seed();
    await linkDoctorUser(ctx.unitOfWork, doctor.id, { userId: 'kc-1' });
    const before = ctx.outbox.events.length;

    const again = await linkDoctorUser(ctx.unitOfWork, doctor.id, { userId: 'kc-1' });

    expect(again.userId).toBe('kc-1');
    expect(ctx.outbox.events).toHaveLength(before);
  });

  it('у врача уже есть другая учётная запись → 409, связка не перезаписана', async () => {
    const { ctx, doctor } = await seed();
    await linkDoctorUser(ctx.unitOfWork, doctor.id, { userId: 'kc-1' });

    await expect(
      linkDoctorUser(ctx.unitOfWork, doctor.id, { userId: 'kc-2' }),
    ).rejects.toMatchObject({ status: 409 });

    expect((await ctx.doctors.findById(doctor.id))?.userId).toBe('kc-1');
  });

  it('userId привязан к другому врачу → 409 (уникальность связки)', async () => {
    const { ctx, spec, doctor } = await seed();
    const other = await createDoctor(ctx.unitOfWork, ctx.specializations, {
      firstName: 'Пётр',
      lastName: 'Сидоров',
      specializationId: spec.id,
      schedule,
    });
    await linkDoctorUser(ctx.unitOfWork, other.id, { userId: 'kc-1' });

    await expect(
      linkDoctorUser(ctx.unitOfWork, doctor.id, { userId: 'kc-1' }),
    ).rejects.toMatchObject({ status: 409 });

    expect((await ctx.doctors.findById(doctor.id))?.userId).toBeFalsy();
  });

  it('неизвестный врач → 404, ничего не записано', async () => {
    const { ctx } = await seed();
    const before = ctx.outbox.events.length;

    await expect(
      linkDoctorUser(ctx.unitOfWork, 'no-such-doctor', { userId: 'kc-1' }),
    ).rejects.toMatchObject({ status: 404 });

    expect(ctx.outbox.events).toHaveLength(before);
  });
});
