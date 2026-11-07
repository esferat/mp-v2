import { describe, expect, it } from 'vitest';
import { RoutingKeys } from '@mp/contracts';
import { updatePatient } from '../src/features/update-patient';
import { makePatientContext, seedPatient } from './helpers/in-memory';

const ADMIN = { sub: 'admin-1', roles: ['ADMIN'] };
const OWNER = { sub: 'kc-user-1', roles: ['USER'] };
const OTHER = { sub: 'kc-user-2', roles: ['USER'] };

const base = {
  email: 'new@test.mp',
  firstName: 'Новый',
  lastName: 'Имя',
  middleName: 'Отчество',
  birthDate: '1991-02-03',
};

describe('updatePatient (use-case, 4.2 + событие 4.6)', () => {
  it('ADMIN обновляет карточку, публикуется patient.updated.v1', async () => {
    const { repo, outbox, uow } = makePatientContext();
    const patient = await seedPatient(repo);

    const updated = await updatePatient(uow, patient.id, base, ADMIN);

    expect(updated).toMatchObject({ email: 'new@test.mp', firstName: 'Новый' });
    expect(outbox.events).toHaveLength(1);
    expect(outbox.events[0]?.routingKey).toBe(RoutingKeys.PatientUpdated);
    expect(outbox.events[0]?.payload).toMatchObject({
      payload: { patientId: patient.id, email: 'new@test.mp' },
    });
  });

  it('ВЛАДЕЛЕЦ (USER со своим sub) обновляет свою карточку', async () => {
    const { repo, uow } = makePatientContext();
    const patient = await seedPatient(repo);

    const updated = await updatePatient(uow, patient.id, base, OWNER);

    expect(updated.firstName).toBe('Новый');
  });

  it('ЧУЖОЙ USER → 403, изменения не записаны (защита в глубину)', async () => {
    const { repo, outbox, uow } = makePatientContext();
    const patient = await seedPatient(repo);

    await expect(updatePatient(uow, patient.id, base, OTHER)).rejects.toMatchObject({
      status: 403,
    });
    expect((await repo.findById(patient.id))?.firstName).toBe('Иван');
    expect(outbox.events).toHaveLength(0);
  });

  it('id в теле не совпадает с путём → 400 field=id', async () => {
    const { repo, uow } = makePatientContext();
    const patient = await seedPatient(repo);

    await expect(
      updatePatient(uow, patient.id, { ...base, id: 'other' }, ADMIN),
    ).rejects.toMatchObject({ status: 400, field: 'id' });
  });

  it('дата рождения в будущем → 400 field=birthDate', async () => {
    const { repo, uow } = makePatientContext();
    const patient = await seedPatient(repo);

    await expect(
      updatePatient(uow, patient.id, { ...base, birthDate: '2999-01-01' }, ADMIN),
    ).rejects.toMatchObject({ status: 400, field: 'birthDate' });
  });

  it('неизвестная карточка → 404', async () => {
    const { uow } = makePatientContext();
    await expect(updatePatient(uow, 'nope', base, ADMIN)).rejects.toMatchObject({ status: 404 });
  });

  it('email, занятый другим пациентом → 409', async () => {
    const { repo, uow } = makePatientContext();
    const patient = await seedPatient(repo);
    await seedPatient(repo, { userId: 'kc-user-9', email: 'taken@test.mp' });

    await expect(
      updatePatient(uow, patient.id, { ...base, email: 'taken@test.mp' }, ADMIN),
    ).rejects.toMatchObject({ status: 409 });
  });
});
