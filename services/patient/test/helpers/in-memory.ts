import type { Patient, PatientContext, PatientRepository } from '../../src/entities/patient';
import type { UnitOfWork } from '../../src/entities/repository';
import type { OutboxWriter } from '../../src/shared/model';
import { ConflictError, NotFoundError } from '../../src/shared/model';

/**
 * In-memory реализации портов patient-service для unit-тестов (0.7 AC):
 * уникальность userId/email как в БД, без PostgreSQL.
 */
export class InMemoryPatientRepository implements PatientRepository {
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
    // Занятость email другим пациентом → как P2002 в Prisma (4.2 AC)
    const emailTaken = this.rows.some(
      (other) => other.id !== id && other.email === data.email.toLowerCase(),
    );
    if (emailTaken) {
      throw new ConflictError(`Email ${data.email} уже привязан к другому пациенту`, {
        field: 'email',
      });
    }
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
    return { items: items.slice(query.offset, query.offset + query.limit), total: items.length };
  }
}

export class InMemoryOutbox implements OutboxWriter {
  readonly events: Array<{ routingKey: string; payload: unknown }> = [];

  async enqueue(routingKey: string, payload: unknown): Promise<void> {
    this.events.push({ routingKey, payload });
  }
}

export function makePatientContext(): {
  repo: InMemoryPatientRepository;
  outbox: InMemoryOutbox;
  uow: UnitOfWork<PatientContext>;
} {
  const repo = new InMemoryPatientRepository();
  const outbox = new InMemoryOutbox();
  const uow: UnitOfWork<PatientContext> = {
    run: (fn) => fn({ patients: repo, outbox }),
  };
  return { repo, outbox, uow };
}

/** Карточка-заглушка для тестов. */
export function seedPatient(
  repo: InMemoryPatientRepository,
  overrides: Partial<Patient> = {},
): Promise<Patient> {
  return repo.createIfAbsent({
    userId: 'kc-user-1',
    email: 'patient@test.mp',
    firstName: 'Иван',
    lastName: 'Петров',
    birthDate: '1990-05-20',
    ...overrides,
  });
}
