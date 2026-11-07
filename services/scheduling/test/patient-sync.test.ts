import { describe, expect, it } from 'vitest';
import { RoutingKeys } from '@mp/contracts';
import type { ConsumedEvent } from '@mp/service-kit';
import { applyPatientEvent } from '../src/features/patient-sync/app/apply-patient-event';
import { makeSchedulingContext } from './helpers/in-memory';

function patientEvent(payload: {
  patientId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
}): ConsumedEvent {
  return {
    routingKey: RoutingKeys.PatientUpdated,
    body: {
      eventId: '11111111-1111-4111-8111-111111111111',
      occurredAt: '2026-11-07T10:00:00.000Z',
      payload: { userId: 'u-1', birthDate: '1990-01-01', email: 'p@test.mp', ...payload },
    },
    raw: {} as ConsumedEvent['raw'],
  };
}

async function seedAppointment(context: ReturnType<typeof makeSchedulingContext>) {
  return context.appointments.create({
    doctorId: 'doc-1',
    doctorName: 'Петров Иван',
    specializationId: 'sp-1',
    specializationName: 'Хирург',
    patientId: 'pt-1',
    patientName: 'Старая Фамилия',
    startTime: '10:00',
    endTime: '10:30',
    localDate: '2026-11-10',
  });
}

describe('applyPatientEvent (4.6: денализация ФИО в записях)', () => {
  it('обновляет ФИО во всех записях пациента (списки/история видят текущее имя)', async () => {
    const context = makeSchedulingContext();
    await seedAppointment(context);
    await context.appointments.create({
      doctorId: 'doc-2',
      doctorName: 'Сидоров Пётр',
      specializationId: 'sp-2',
      specializationName: 'Кардиолог',
      patientId: 'pt-1',
      patientName: 'Старая Фамилия',
      startTime: '11:00',
      endTime: '11:30',
      localDate: '2026-11-12',
    });

    const result = await applyPatientEvent(
      context.appointments,
      patientEvent({ patientId: 'pt-1', firstName: 'Новое', lastName: 'Имя', middleName: 'Отч' }),
    );

    expect(result.updated).toBe(2);
    const page = await context.appointments.findPage({ offset: 0, limit: 10, patientId: 'pt-1' });
    expect(page.items.every((row) => row.patientName === 'Имя Новое Отч')).toBe(true);
    // снапшоты врачей не тронуты (порядок: localDate desc)
    expect(page.items.map((row) => row.doctorName)).toEqual(['Сидоров Пётр', 'Петров Иван']);
  });

  it('повтор того же события идемпотентен: 0 изменений (AC 4.6)', async () => {
    const context = makeSchedulingContext();
    await seedAppointment(context);
    const event = patientEvent({ patientId: 'pt-1', firstName: 'Новое', lastName: 'Имя' });

    const first = await applyPatientEvent(context.appointments, event);
    const second = await applyPatientEvent(context.appointments, event);

    expect(first.updated).toBe(1);
    expect(second.updated).toBe(0);
    expect(context.appointments.rows.size).toBe(1); // дублей записей нет
  });

  it('чужие записи не затрагиваются', async () => {
    const context = makeSchedulingContext();
    await seedAppointment(context);
    await context.appointments.create({
      doctorId: 'doc-3',
      doctorName: 'Врач Третий',
      specializationId: 'sp-3',
      specializationName: 'Невролог',
      patientId: 'pt-OTHER',
      patientName: 'Чужой Пациент',
      startTime: '12:00',
      endTime: '12:30',
      localDate: '2026-11-11',
    });

    await applyPatientEvent(
      context.appointments,
      patientEvent({ patientId: 'pt-1', firstName: 'Новое', lastName: 'Имя' }),
    );

    const other = await context.appointments.findPage({
      offset: 0,
      limit: 10,
      patientId: 'pt-OTHER',
    });
    expect(other.items[0]?.patientName).toBe('Чужой Пациент');
  });
});
