import { describe, expect, it } from 'vitest';
import type { Patient, PatientRepository } from '../src/entities/patient';
import { ConflictError, NotFoundError } from '../src/shared/model';
import { createPatient } from '../src/features/create-patient';
import { getPatientByUser } from '../src/features/get-patient-by-user';

/**
 * In-memory репозиторий: уникальность userId/email, как в БД (1.4 AC —
 * двойной submit → одна карточка). Тесты проходят без PostgreSQL.
 */
class InMemoryPatientRepository implements PatientRepository {
  readonly rows: Patient[] = [];
  private seq = 0;

  async findByUserId(userId: string): Promise<Patient | null> {
    return this.rows.find((row) => row.userId === userId) ?? null;
  }

  async createIfAbsent(data: Omit<Patient, 'id' | 'registeredAt'>): Promise<Patient> {
    const byUser = await this.findByUserId(data.userId);
    if (byUser) return byUser;

    if (this.rows.some((row) => row.email === data.email)) {
      throw new ConflictError(`Email ${data.email} уже привязан к другому пациенту`);
    }

    const row: Patient = {
      id: `pt-${++this.seq}`,
      registeredAt: new Date().toISOString(),
      ...data,
    };
    this.rows.push(row);
    return row;
  }
}

const command = {
  userId: 'kc-user-1',
  email: 'Patient@Test.MP',
  firstName: 'Иван',
  lastName: 'Петров',
  middleName: 'Сергеевич',
  birthDate: '1990-05-20',
};

describe('createPatient (use-case, 1.4 — шаг B саги)', () => {
  it('создаёт карточку, email нормализуется в нижний регистр', async () => {
    const repo = new InMemoryPatientRepository();

    const patient = await createPatient(repo, command);

    expect(patient).toMatchObject({
      userId: 'kc-user-1',
      email: 'patient@test.mp',
      firstName: 'Иван',
      birthDate: '1990-05-20',
    });
    expect(repo.rows).toHaveLength(1);
  });

  it('двойной submit → одна карточка (AC 1.4)', async () => {
    const repo = new InMemoryPatientRepository();

    const first = await createPatient(repo, command);
    const second = await createPatient(repo, { ...command, email: 'patient@test.mp' });

    expect(second.id).toBe(first.id);
    expect(repo.rows).toHaveLength(1);
  });

  it('email, привязанный к другому userId → 409', async () => {
    const repo = new InMemoryPatientRepository();
    await createPatient(repo, command);

    await expect(createPatient(repo, { ...command, userId: 'kc-user-2' })).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(repo.rows).toHaveLength(1);
  });
});

describe('getPatientByUser (use-case)', () => {
  it('возвращает карточку по userId', async () => {
    const repo = new InMemoryPatientRepository();
    const created = await createPatient(repo, command);

    await expect(getPatientByUser(repo, 'kc-user-1')).resolves.toMatchObject({
      id: created.id,
    });
  });

  it('карточки нет → 404 (сага дособирает на повторе)', async () => {
    const repo = new InMemoryPatientRepository();
    await expect(getPatientByUser(repo, 'kc-unknown')).rejects.toBeInstanceOf(NotFoundError);
  });
});
