import { describe, expect, it } from 'vitest';
import { RoutingKeys } from '@mp/contracts';
import type { Patient, PatientContext, PatientRepository } from '../src/entities/patient';
import type { UnitOfWork } from '../src/entities/repository';
import type { OutboxWriter } from '../src/shared/model';
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

  async findById(id: string): Promise<Patient | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async setPhoto(id: string, key: string | null): Promise<Patient | null> {
    const row = await this.findById(id);
    if (!row) return null;
    if (key === null) delete row.photoKey;
    else row.photoKey = key;
    return row;
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

  async update(
    id: string,
    data: {
      email: string;
      firstName: string;
      lastName: string;
      middleName?: string;
      birthDate: string;
    },
  ): Promise<Patient> {
    const row = await this.findById(id);
    if (!row) throw new NotFoundError(`Пациент ${id} не найден`);
    const next: Patient = {
      ...row,
      email: data.email.toLowerCase(),
      firstName: data.firstName,
      lastName: data.lastName,
      birthDate: data.birthDate,
    };
    if (data.middleName) next.middleName = data.middleName;
    else delete next.middleName;
    this.rows.splice(this.rows.indexOf(row), 1, next);
    return next;
  }

  async findPage(query: {
    offset: number;
    limit: number;
    search?: string;
  }): Promise<{ items: Patient[]; total: number }> {
    const search = query.search?.trim().toLowerCase();
    let items = this.rows;
    if (search) {
      items = items.filter((row) =>
        `${row.lastName} ${row.firstName} ${row.middleName ?? ''} ${row.email}`
          .toLowerCase()
          .includes(search),
      );
    }
    return {
      items: items.slice(query.offset, query.offset + query.limit),
      total: items.length,
    };
  }
}

class InMemoryOutbox implements OutboxWriter {
  readonly events: Array<{ routingKey: string; payload: unknown }> = [];

  async enqueue(routingKey: string, payload: unknown): Promise<void> {
    this.events.push({ routingKey, payload });
  }
}

function makeUow(
  repo: InMemoryPatientRepository,
  outbox: InMemoryOutbox,
): UnitOfWork<PatientContext> {
  return {
    run: (fn) => fn({ patients: repo, outbox }),
  };
}

function makeContext() {
  const repo = new InMemoryPatientRepository();
  const outbox = new InMemoryOutbox();
  return { repo, outbox, uow: makeUow(repo, outbox) };
}

const command = {
  userId: 'kc-user-1',
  email: 'Patient@Test.MP',
  firstName: 'Иван',
  lastName: 'Петров',
  middleName: 'Сергеевич',
  birthDate: '1990-05-20',
};

describe('createPatient (use-case, 1.4 шаг B + событие 4.6)', () => {
  it('создаёт карточку, email нормализуется, публикуется patient.created.v1', async () => {
    const { repo, outbox, uow } = makeContext();

    const patient = await createPatient(uow, command);

    expect(patient).toMatchObject({
      userId: 'kc-user-1',
      email: 'patient@test.mp',
      firstName: 'Иван',
      birthDate: '1990-05-20',
    });
    expect(repo.rows).toHaveLength(1);

    expect(outbox.events).toHaveLength(1);
    expect(outbox.events[0]?.routingKey).toBe(RoutingKeys.PatientCreated);
    expect(outbox.events[0]?.payload).toMatchObject({
      eventId: expect.any(String),
      payload: { patientId: patient.id, email: 'patient@test.mp', lastName: 'Петров' },
    });
  });

  it('двойной submit → одна карточка и БЕЗ повторного события (AC 1.4/4.6)', async () => {
    const { repo, outbox, uow } = makeContext();

    const first = await createPatient(uow, command);
    const second = await createPatient(uow, { ...command, email: 'patient@test.mp' });

    expect(second.id).toBe(first.id);
    expect(repo.rows).toHaveLength(1);
    expect(outbox.events).toHaveLength(1);
  });

  it('email, привязанный к другому userId → 409', async () => {
    const { repo, uow } = makeContext();
    await createPatient(uow, command);

    await expect(createPatient(uow, { ...command, userId: 'kc-user-2' })).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(repo.rows).toHaveLength(1);
  });
});

describe('getPatientByUser (use-case)', () => {
  it('возвращает карточку по userId', async () => {
    const { repo, uow } = makeContext();
    const created = await createPatient(uow, command);

    await expect(getPatientByUser(repo, 'kc-user-1')).resolves.toMatchObject({
      id: created.id,
    });
  });

  it('карточки нет → 404 (сага дособирает на повторе)', async () => {
    const { repo } = makeContext();
    await expect(getPatientByUser(repo, 'kc-unknown')).rejects.toBeInstanceOf(NotFoundError);
  });
});
