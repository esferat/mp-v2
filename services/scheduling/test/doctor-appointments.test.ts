import { describe, expect, it } from 'vitest';
import { getDoctorAppointments } from '../src/features/get-doctor-appointments';
import { getDoctorPatients } from '../src/features/get-doctor-patients';
import { makeSchedulingContext } from './helpers/in-memory';

const DOCTOR = { sub: 'doctor-user-1', roles: ['DOCTOR'] };
const OTHER_DOCTOR = { sub: 'doctor-user-2', roles: ['DOCTOR'] };
const PATIENT = { sub: 'user-x', roles: ['USER'] };
const ADMIN = { sub: 'admin-1', roles: ['ADMIN'] };

/**
 * Два врача с привязкой userId (9.1) и записи каждого — база для 9.2/9.3:
 * врач видит только СВОИ записи и только СВОИХ пациентов.
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
  await context.copies.applyDoctorEvent({
    doctorId: 'doc-2',
    userId: 'doctor-user-2',
    specializationId: 'sp-2',
    specializationName: 'Кардиолог',
    lastName: 'Сидоров',
    firstName: 'Пётр',
    status: 'ACTIVE',
    schedule: { startTime: '09:00', endTime: '18:00', durationMinutes: 30, workDays: [1] },
    occurredAt: '2026-11-01T00:00:00.000Z',
  });

  // Две записи doc-1 (одна пациентка дважды) + одна у doc-2
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
  await context.appointments.create({
    doctorId: 'doc-1',
    doctorName: 'Петров Иван',
    specializationId: 'sp-1',
    specializationName: 'Хирург',
    patientId: 'pt-A',
    patientName: 'Пациент А',
    startTime: '11:00',
    endTime: '11:30',
    localDate: '2026-11-17',
  });
  await context.appointments.create({
    doctorId: 'doc-1',
    doctorName: 'Петров Иван',
    specializationId: 'sp-1',
    specializationName: 'Хирург',
    patientId: 'pt-B',
    patientName: 'Пациент Б',
    startTime: '12:00',
    endTime: '12:30',
    localDate: '2026-11-12',
  });
  await context.appointments.create({
    doctorId: 'doc-2',
    doctorName: 'Сидоров Пётр',
    specializationId: 'sp-2',
    specializationName: 'Кардиолог',
    patientId: 'pt-C',
    patientName: 'Пациент В',
    startTime: '09:00',
    endTime: '09:30',
    localDate: '2026-11-11',
  });

  return context;
}

const pageQuery = { offset: 0, limit: 10 };

describe('getDoctorAppointments (9.2: свои записи)', () => {
  it('врач видит только свои записи, независимо от параметров запроса', async () => {
    const context = await seed();

    const mine = await getDoctorAppointments(
      { appointments: context.appointments, copies: context.copies },
      pageQuery,
      DOCTOR,
    );
    expect(mine.total).toBe(3);
    expect(mine.items.every((item) => item.doctorId === 'doc-1')).toBe(true);

    // Попытка подсмотреть чужие через параметр doctorId игнорируется
    const forged = await getDoctorAppointments(
      { appointments: context.appointments, copies: context.copies },
      { ...pageQuery, doctorId: 'doc-2' },
      DOCTOR,
    );
    expect(forged.total).toBe(3);
    expect(forged.items.every((item) => item.doctorId === 'doc-1')).toBe(true);
  });

  it('фильтр статуса и пагинация работают', async () => {
    const context = await seed();

    const filtered = await getDoctorAppointments(
      { appointments: context.appointments, copies: context.copies },
      { ...pageQuery, status: 'SUBMITTED' },
      DOCTOR,
    );
    expect(filtered.total).toBe(3);

    const paged = await getDoctorAppointments(
      { appointments: context.appointments, copies: context.copies },
      { offset: 1, limit: 1 },
      DOCTOR,
    );
    expect(paged.total).toBe(3);
    expect(paged.items).toHaveLength(1);
  });

  it('patientId: приёмы конкретного пациента в пределах своих записей (9.3)', async () => {
    const context = await seed();

    const onlyA = await getDoctorAppointments(
      { appointments: context.appointments, copies: context.copies },
      { ...pageQuery, patientId: 'pt-A' },
      DOCTOR,
    );
    // у doc-1 две записи pt-A (10.11 и 17.11), pt-B и чужой doc-2 — не попадают
    expect(onlyA.total).toBe(2);
    expect(onlyA.items.every((item) => item.patientId === 'pt-A')).toBe(true);
    expect(onlyA.items.every((item) => item.doctorId === 'doc-1')).toBe(true);

    // несуществующий пациент → пусто, а не все записи
    const empty = await getDoctorAppointments(
      { appointments: context.appointments, copies: context.copies },
      { ...pageQuery, patientId: 'no-such' },
      DOCTOR,
    );
    expect(empty.total).toBe(0);
    expect(empty.items).toHaveLength(0);
  });

  it('другой врач видит только свои; пациент -> 403 (нет привязки)', async () => {
    const context = await seed();

    const other = await getDoctorAppointments(
      { appointments: context.appointments, copies: context.copies },
      pageQuery,
      OTHER_DOCTOR,
    );
    expect(other.total).toBe(1);
    expect(other.items[0]?.doctorId).toBe('doc-2');

    await expect(
      getDoctorAppointments(
        { appointments: context.appointments, copies: context.copies },
        pageQuery,
        PATIENT,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('врач без привязки userId (старые копии) -> 403, пока нет re-import', async () => {
    const context = await seed();
    await context.copies.applyDoctorEvent({
      doctorId: 'doc-legacy',
      userId: null,
      specializationId: 'sp-1',
      specializationName: 'Хирург',
      lastName: 'Легаси',
      firstName: 'Врач',
      status: 'ACTIVE',
      schedule: { startTime: '09:00', endTime: '18:00', durationMinutes: 30, workDays: [1] },
      occurredAt: '2026-11-01T00:00:00.000Z',
    });

    await expect(
      getDoctorAppointments(
        { appointments: context.appointments, copies: context.copies },
        pageQuery,
        { sub: 'unknown-sub', roles: ['DOCTOR'] },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe('getDoctorPatients (9.3: пациенты врача)', () => {
  it('distinct пациентов врача с последним приёмом, новые сверху', async () => {
    const context = await seed();

    const list = await getDoctorPatients(
      { appointments: context.appointments, copies: context.copies },
      DOCTOR,
    );

    expect(list.total).toBe(2);
    expect(list.items.map((item) => item.patientId)).toEqual(['pt-A', 'pt-B']);
    // Последний приём pt-A — 17.11 (не первый)
    const patientA = list.items.find((item) => item.patientId === 'pt-A');
    expect(patientA?.lastVisit).toBe('2026-11-17');
  });

  it('другой врач видит своих пациентов; пациент -> 403', async () => {
    const context = await seed();

    const other = await getDoctorPatients(
      { appointments: context.appointments, copies: context.copies },
      OTHER_DOCTOR,
    );
    expect(other.total).toBe(1);
    expect(other.items[0]?.patientId).toBe('pt-C');

    await expect(
      getDoctorPatients({ appointments: context.appointments, copies: context.copies }, PATIENT),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('ADMIN не является врачом -> 403 (маршрут только для DOCTOR)', async () => {
    const context = await seed();

    await expect(
      getDoctorPatients({ appointments: context.appointments, copies: context.copies }, ADMIN),
    ).rejects.toMatchObject({ status: 403 });
  });
});
