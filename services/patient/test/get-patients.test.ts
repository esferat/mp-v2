import { describe, expect, it } from 'vitest';
import { getPatients } from '../src/features/get-patients';
import { makePatientContext, seedPatient } from './helpers/in-memory';

const signer = { sign: async (key: string) => `https://cdn.test/patient-photos/${key}?sig=x` };

describe('getPatients (use-case, 4.1)', () => {
  it('список с пагинацией: total, registrationDate, порядок из репозитория', async () => {
    const { repo } = makePatientContext();
    await seedPatient(repo, { userId: 'u1', email: 'one@test.mp', firstName: 'Первый' });
    await seedPatient(repo, { userId: 'u2', email: 'two@test.mp', firstName: 'Второй' });

    const page = await getPatients(repo, undefined, { offset: 0, limit: 1 });

    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      firstName: 'Первый',
      registrationDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    // внутренний photoKey не утекает
    expect(page.items[0]).not.toHaveProperty('photoKey');
  });

  it('поиск по ФИО/email без учёта регистра', async () => {
    const { repo } = makePatientContext();
    await seedPatient(repo, { userId: 'u1', email: 'one@test.mp', lastName: 'Иванов' });
    await seedPatient(repo, {
      userId: 'u2',
      email: 'two@test.mp',
      firstName: 'Второй',
      lastName: 'Петров',
    });

    const byName = await getPatients(repo, undefined, { offset: 0, limit: 10, search: 'ИваНоВ' });
    expect(byName.total).toBe(1);
    expect(byName.items[0]?.lastName).toBe('Иванов');

    const byEmail = await getPatients(repo, undefined, { offset: 0, limit: 10, search: 'TWO@' });
    expect(byEmail.total).toBe(1);
    expect(byEmail.items[0]?.firstName).toBe('Второй');
  });

  it('photoUrl подписывается только при наличии фото', async () => {
    const { repo } = makePatientContext();
    const patient = await seedPatient(repo);
    await repo.setPhoto(patient.id, 'abc.jpg');

    const page = await getPatients(repo, signer, { offset: 0, limit: 10 });

    expect(page.items[0]?.photoUrl).toContain('patient-photos/abc.jpg');
  });
});
