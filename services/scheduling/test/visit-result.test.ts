import { describe, expect, it } from 'vitest';
import { RoutingKeys } from '@mp/contracts';
import { enterVisitResult } from '../src/features/enter-visit-result';
import { getVisitResult, updateVisitResult } from '../src/features/visit-result';
import { makeSchedulingContext } from './helpers/in-memory';

const DOCTOR = { sub: 'doctor-user-1', roles: ['DOCTOR'] };
const OTHER_DOCTOR = { sub: 'doctor-user-2', roles: ['DOCTOR'] };
const PATIENT = { sub: 'user-1', roles: ['USER'] };

/**
 * Копия врача с привязкой userId (9.1) + запись в статусе APPROVED —
 * базовый сценарий 9.2: внесение результата своим врачом.
 */
async function seedApproved() {
  const context = makeSchedulingContext();
  await context.copies.applyDoctorEvent({
    doctorId: 'doc-1',
    userId: 'doctor-user-1',
    specializationId: 'sp-1',
    specializationName: 'Хирург',
    lastName: 'Петров',
    firstName: 'Иван',
    status: 'ACTIVE',
    schedule: {
      startTime: '09:00',
      endTime: '18:00',
      durationMinutes: 30,
      workDays: [1, 2, 3, 4, 5],
    },
    occurredAt: '2026-11-01T00:00:00.000Z',
  });
  const appointment = await context.appointments.create({
    doctorId: 'doc-1',
    doctorName: 'Петров Иван',
    specializationId: 'sp-1',
    specializationName: 'Хирург',
    patientId: 'pt-1',
    patientName: 'Иванова Ольга',
    startTime: '10:00',
    endTime: '10:30',
    localDate: '2026-11-10',
  });
  // APPROVED (канон: результат вносится только из APPROVED)
  await context.appointments.updateStatus(appointment.id, 'APPROVED');
  context.outbox.events.length = 0; // отсекаем события брони/приёма
  return { context, appointment };
}

describe('enterVisitResult (9.2)', () => {
  it('врач записи вносит результат: COMPLETED + строка + appointment.completed.v1', async () => {
    const { context, appointment } = await seedApproved();

    const result = await enterVisitResult(
      { unitOfWork: context.unitOfWork, copies: context.copies },
      appointment.id,
      { conclusion: 'Всё хорошо', recommendations: 'Пить воду' },
      DOCTOR,
    );

    expect(result).toMatchObject({
      appointmentId: appointment.id,
      conclusion: 'Всё хорошо',
      recommendations: 'Пить воду',
      createdBy: 'doctor-user-1',
    });

    const updated = await context.appointments.findById(appointment.id);
    expect(updated?.status).toBe('COMPLETED');
    expect(updated?.visitResult).toMatchObject({ conclusion: 'Всё хорошо' });

    expect(context.outbox.events).toHaveLength(1);
    expect(context.outbox.events[0]?.routingKey).toBe(RoutingKeys.AppointmentCompleted);
  });

  it('повторный submit идемпотентен: существующий результат возвращается (AC 9.2)', async () => {
    const { context, appointment } = await seedApproved();
    const command = { conclusion: 'Заключение' };

    const first = await enterVisitResult(
      { unitOfWork: context.unitOfWork, copies: context.copies },
      appointment.id,
      command,
      DOCTOR,
    );
    const second = await enterVisitResult(
      { unitOfWork: context.unitOfWork, copies: context.copies },
      appointment.id,
      command,
      DOCTOR,
    );

    expect(second.id).toBe(first.id);
    expect(context.visitResults.rows.size).toBe(1);
    expect(context.outbox.events).toHaveLength(1); // событие не задублировано
  });

  it('чужой врач -> 403, ничего не записано', async () => {
    const { context, appointment } = await seedApproved();

    await expect(
      enterVisitResult(
        { unitOfWork: context.unitOfWork, copies: context.copies },
        appointment.id,
        { conclusion: 'Чужое' },
        OTHER_DOCTOR,
      ),
    ).rejects.toMatchObject({ status: 403 });

    expect((await context.appointments.findById(appointment.id))?.status).toBe('APPROVED');
    expect(context.visitResults.rows.size).toBe(0);
  });

  it('пациент (не врач) -> 403: нет привязки sub -> doctorId', async () => {
    const { context, appointment } = await seedApproved();

    await expect(
      enterVisitResult(
        { unitOfWork: context.unitOfWork, copies: context.copies },
        appointment.id,
        { conclusion: 'X' },
        PATIENT,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('статус SUBMITTED -> 409 INVALID_TRANSITION, БД не изменилась (канон)', async () => {
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
    const submitted = await context.appointments.create({
      doctorId: 'doc-1',
      doctorName: 'Петров Иван',
      specializationId: 'sp-1',
      specializationName: 'Хирург',
      patientId: 'pt-1',
      patientName: 'Иванова Ольга',
      startTime: '10:00',
      endTime: '10:30',
      localDate: '2026-11-10',
    });

    await expect(
      enterVisitResult(
        { unitOfWork: context.unitOfWork, copies: context.copies },
        submitted.id,
        { conclusion: 'X' },
        DOCTOR,
      ),
    ).rejects.toMatchObject({ status: 409, code: 'INVALID_TRANSITION' });

    expect((await context.appointments.findById(submitted.id))?.status).toBe('SUBMITTED');
    expect(context.visitResults.rows.size).toBe(0);
  });

  it('пустое заключение -> 400 field=conclusion (валидация в домене)', async () => {
    const { context, appointment } = await seedApproved();

    await expect(
      enterVisitResult(
        { unitOfWork: context.unitOfWork, copies: context.copies },
        appointment.id,
        { conclusion: '   ' },
        DOCTOR,
      ),
    ).rejects.toMatchObject({ status: 400, field: 'conclusion' });
  });

  it('неизвестная запись -> 404', async () => {
    const { context } = await seedApproved();

    await expect(
      enterVisitResult(
        { unitOfWork: context.unitOfWork, copies: context.copies },
        'nope',
        { conclusion: 'X' },
        DOCTOR,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('getVisitResult / updateVisitResult (9.2)', () => {
  it('врач записи читает результат; чужой врач -> 403', async () => {
    const { context, appointment } = await seedApproved();
    await enterVisitResult(
      { unitOfWork: context.unitOfWork, copies: context.copies },
      appointment.id,
      { conclusion: 'Заключение' },
      DOCTOR,
    );

    const result = await getVisitResult(
      {
        appointments: context.appointments,
        copies: context.copies,
        visitResults: context.visitResults,
      },
      appointment.id,
      DOCTOR,
    );
    expect(result.conclusion).toBe('Заключение');

    await expect(
      getVisitResult(
        {
          appointments: context.appointments,
          copies: context.copies,
          visitResults: context.visitResults,
        },
        appointment.id,
        OTHER_DOCTOR,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('результата нет -> 404', async () => {
    const { context, appointment } = await seedApproved();

    await expect(
      getVisitResult(
        {
          appointments: context.appointments,
          copies: context.copies,
          visitResults: context.visitResults,
        },
        appointment.id,
        DOCTOR,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('врач записи правит результат; чужой -> 403; пустое -> 400', async () => {
    const { context, appointment } = await seedApproved();
    await enterVisitResult(
      { unitOfWork: context.unitOfWork, copies: context.copies },
      appointment.id,
      { conclusion: 'Было' },
      DOCTOR,
    );

    const updated = await updateVisitResult(
      {
        appointments: context.appointments,
        copies: context.copies,
        visitResults: context.visitResults,
      },
      appointment.id,
      { conclusion: 'Стало', recommendations: 'Новое' },
      DOCTOR,
    );
    expect(updated).toMatchObject({ conclusion: 'Стало', recommendations: 'Новое' });

    await expect(
      updateVisitResult(
        {
          appointments: context.appointments,
          copies: context.copies,
          visitResults: context.visitResults,
        },
        appointment.id,
        { conclusion: 'Чужое' },
        OTHER_DOCTOR,
      ),
    ).rejects.toMatchObject({ status: 403 });

    await expect(
      updateVisitResult(
        {
          appointments: context.appointments,
          copies: context.copies,
          visitResults: context.visitResults,
        },
        appointment.id,
        { conclusion: ' ' },
        DOCTOR,
      ),
    ).rejects.toMatchObject({ status: 400, field: 'conclusion' });
  });
});
