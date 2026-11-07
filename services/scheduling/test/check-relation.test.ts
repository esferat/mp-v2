import { describe, expect, it } from 'vitest';
import { checkDoctorRelation, getDoctorByUser } from '../src/features/check-relation';
import { makeSchedulingContext } from './helpers/in-memory';

/**
 * Связь «врач-пациент» (9.3): источник истины — записи scheduling
 * (APPROVED/COMPLETED дают доступ к документам, остальные — нет).
 */
async function seed() {
  const context = makeSchedulingContext();
  await context.copies.applyDoctorEvent({
    doctorId: 'doc-1',
    userId: 'doctor-user-1',
    specializationId: 'sp-1',
    specializationName: 'Хирург',
    lastName: 'Петров',
    firstName: 'Иван',
    status: 'ACTIVE',
    schedule: { startTime: '09:00', endTime: '18:00', durationMinutes: 30, workDays: [1] },
    occurredAt: '2026-11-01T00:00:00.000Z',
  });
  // Врач 1: запись с пациентом pt-A в разных статусах
  await context.appointments.create({
    doctorId: 'doc-1',
    doctorName: 'Петров Иван',
    specializationId: 'sp-1',
    specializationName: 'Хирург',
    patientId: 'pt-A',
    patientName: 'Пациент А',
    startTime: '10:00',
    endTime: '10:30',
    localDate: '2026-11-10',
  });
  // Врач 1: запись с пациентом pt-B (SUBMITTED — связи не даёт)
  await context.appointments.create({
    doctorId: 'doc-1',
    doctorName: 'Петров Иван',
    specializationId: 'sp-1',
    specializationName: 'Хирург',
    patientId: 'pt-B',
    patientName: 'Пациент Б',
    startTime: '11:00',
    endTime: '11:30',
    localDate: '2026-11-11',
  });
  // Врач 2: запись с pt-A (чужая для врача 1)
  await context.appointments.create({
    doctorId: 'doc-2',
    doctorName: 'Сидоров Пётр',
    specializationId: 'sp-2',
    specializationName: 'Кардиолог',
    patientId: 'pt-A',
    patientName: 'Пациент А',
    startTime: '09:00',
    endTime: '09:30',
    localDate: '2026-11-11',
  });

  // поднимаем первую запись doc-1/pt-A в APPROVED
  const page = await context.appointments.findPage({
    offset: 0,
    limit: 1,
    doctorId: 'doc-1',
    patientId: 'pt-A',
  });
  await context.appointments.updateStatus(page.items[0]!.id, 'APPROVED');

  return context;
}

const deps = (context: ReturnType<typeof makeSchedulingContext>) => ({
  appointments: context.appointments,
  copies: context.copies,
});

describe('checkDoctorRelation (9.3: связь врач-пациент)', () => {
  it('APPROVED-запись -> related=true', async () => {
    const context = await seed();
    await expect(
      checkDoctorRelation(deps(context), { userId: 'doctor-user-1', patientId: 'pt-A' }),
    ).resolves.toEqual({ related: true });
  });

  it('SUBMITTED-запись -> related=false (доступа нет)', async () => {
    const context = await seed();
    await expect(
      checkDoctorRelation(deps(context), { userId: 'doctor-user-1', patientId: 'pt-B' }),
    ).resolves.toEqual({ related: false });
  });

  it('COMPLETED-запись -> related=true', async () => {
    const context = await seed();
    const page = await context.appointments.findPage({
      offset: 0,
      limit: 1,
      doctorId: 'doc-1',
      patientId: 'pt-A',
    });
    await context.appointments.updateStatus(page.items[0]!.id, 'COMPLETED');

    await expect(
      checkDoctorRelation(deps(context), { userId: 'doctor-user-1', patientId: 'pt-A' }),
    ).resolves.toEqual({ related: true });
  });

  it('отменённая запись -> related=false (потеря связи закрывает доступ, AC 9.3)', async () => {
    const context = await seed();
    const page = await context.appointments.findPage({
      offset: 0,
      limit: 1,
      doctorId: 'doc-1',
      patientId: 'pt-A',
    });
    await context.appointments.updateStatus(page.items[0]!.id, 'CANCELLED');

    await expect(
      checkDoctorRelation(deps(context), { userId: 'doctor-user-1', patientId: 'pt-A' }),
    ).resolves.toEqual({ related: false });
  });

  it('запись ДРУГОГО врача с тем же пациентом связи не создаёт', async () => {
    const context = await seed();
    await expect(
      checkDoctorRelation(deps(context), { userId: 'doctor-user-2', patientId: 'pt-A' }),
    ).resolves.toEqual({ related: false });
  });

  it('врач без записей с пациентом -> related=false', async () => {
    const context = await seed();
    await expect(
      checkDoctorRelation(deps(context), { userId: 'doctor-user-1', patientId: 'pt-OTHER' }),
    ).resolves.toEqual({ related: false });
  });

  it('неизвестный sub (нет привязки) -> related=false, не ошибка', async () => {
    const context = await seed();
    await expect(
      checkDoctorRelation(deps(context), { userId: 'ghost-sub', patientId: 'pt-A' }),
    ).resolves.toEqual({ related: false });
  });
});

describe('getDoctorByUser (9.3: sub -> doctorId)', () => {
  it('возвращает doctorId по привязке userId', async () => {
    const context = await seed();
    await expect(getDoctorByUser(deps(context), 'doctor-user-1')).resolves.toEqual({
      doctorId: 'doc-1',
    });
  });

  it('нет привязки -> 404 (file трактует как «только админ»)', async () => {
    const context = await seed();
    await expect(getDoctorByUser(deps(context), 'ghost-sub')).rejects.toMatchObject({
      status: 404,
    });
  });
});
