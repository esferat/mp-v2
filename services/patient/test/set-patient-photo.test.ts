import { describe, expect, it } from 'vitest';
import type { Patient, PatientRepository } from '../src/entities/patient';
import { setPatientPhoto } from '../src/features/set-patient-photo';

/** In-memory репозиторий: только нужные порту методы (0.7 AC). */
class InMemoryPatientRepository implements PatientRepository {
  readonly rows = new Map<string, Patient>();
  private seq = 0;

  async findByUserId(userId: string): Promise<Patient | null> {
    return [...this.rows.values()].find((row) => row.userId === userId) ?? null;
  }

  async findById(id: string): Promise<Patient | null> {
    return this.rows.get(id) ?? null;
  }

  async setPhoto(id: string, key: string | null): Promise<Patient | null> {
    const row = this.rows.get(id);
    if (!row) return null;
    const updated: Patient = { ...row };
    if (key === null) delete (updated as { photoKey?: string }).photoKey;
    else updated.photoKey = key;
    this.rows.set(id, updated);
    return updated;
  }

  async createIfAbsent(data: Omit<Patient, 'id' | 'registeredAt'>): Promise<Patient> {
    const row: Patient = {
      id: `pt-${++this.seq}`,
      registeredAt: new Date().toISOString(),
      ...data,
    };
    this.rows.set(row.id, row);
    return row;
  }
}

async function seed(): Promise<InMemoryPatientRepository> {
  const repo = new InMemoryPatientRepository();
  await repo.createIfAbsent({
    userId: 'kc-user-1',
    email: 'patient@test.mp',
    firstName: 'Иван',
    lastName: 'Петров',
    birthDate: '1990-05-20',
  });
  return repo;
}

describe('setPatientPhoto (use-case, 4.3)', () => {
  it('привязывает фото и возвращает прежний ключ (null, если не было)', async () => {
    const repo = await seed();
    const first = await setPatientPhoto(repo, 'pt-1', 'new.jpg');

    expect(first).toEqual({ previousKey: null });
    expect((await repo.findById('pt-1'))?.photoKey).toBe('new.jpg');

    const second = await setPatientPhoto(repo, 'pt-1', 'newer.jpg');
    expect(second).toEqual({ previousKey: 'new.jpg' });
  });

  it('key = null очищает фото и сообщает прежний ключ', async () => {
    const repo = await seed();
    await setPatientPhoto(repo, 'pt-1', 'a.jpg');

    const cleared = await setPatientPhoto(repo, 'pt-1', null);

    expect(cleared).toEqual({ previousKey: 'a.jpg' });
    expect((await repo.findById('pt-1'))?.photoKey).toBeUndefined();
  });

  it('неизвестная карточка -> 404', async () => {
    const repo = await seed();

    await expect(setPatientPhoto(repo, 'no-such', 'a.jpg')).rejects.toMatchObject({
      status: 404,
    });
  });
});
