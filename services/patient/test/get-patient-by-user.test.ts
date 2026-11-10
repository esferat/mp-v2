import { describe, expect, it } from 'vitest';
import { getPatientByUser } from '../src/features/get-patient-by-user';
import { makePatientContext, seedPatient } from './helpers/in-memory';

const signer = { sign: async (key: string) => `https://cdn.test/patient-photos/${key}?sig=x` };

describe('getPatientByUser (use-case, 1.4/3.4: карточка по sub)', () => {
  it('карточка с presigned photoUrl, внутренний photoKey не утекает', async () => {
    const { repo } = makePatientContext();
    const patient = await seedPatient(repo, { userId: 'u-1' });
    await repo.setPhoto(patient.id, 'abc.jpg');

    const result = await getPatientByUser(repo, 'u-1', signer);

    expect(result.id).toBe(patient.id);
    expect(result.photoUrl).toContain('patient-photos/abc.jpg');
    expect(result).not.toHaveProperty('photoKey');
  });

  it('без фото — photoUrl отсутствует (аватар показывает инициалы)', async () => {
    const { repo } = makePatientContext();
    await seedPatient(repo, { userId: 'u-2' });

    const result = await getPatientByUser(repo, 'u-2', signer);

    expect(result.photoUrl).toBeUndefined();
  });

  it('нет карточки → 404', async () => {
    const { repo } = makePatientContext();

    await expect(getPatientByUser(repo, 'no-such', signer)).rejects.toThrow('не найден');
  });
});
