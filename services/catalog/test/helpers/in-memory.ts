import type {
  Specialization,
  SpecializationContext,
  SpecializationRepository,
} from '../src/entities/specialization';
import type {
  CreateDoctorData,
  DoctorContext,
  DoctorListItem,
  DoctorListQuery,
  DoctorRepository,
  DoctorSchedule,
  UpdateDoctorData,
} from '../src/entities/doctor';
import type { OutboxWriter } from '../src/shared/model';
import { UnitOfWork } from '../src/entities/repository';

/**
 * In-memory реализации портов для unit-тестов use-case'ов:
 * без БД и без Nest-контейнера (0.7 AC: тесты без интеграции).
 */

export interface EnqueuedEvent {
  routingKey: string;
  payload: unknown;
}

export class InMemorySpecializationRepository implements SpecializationRepository {
  readonly rows = new Map<string, Specialization>();
  private seq = 0;

  async findAll(): Promise<Specialization[]> {
    return [...this.rows.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }

  async findByName(name: string): Promise<Specialization | null> {
    const key = name.toLowerCase();
    return [...this.rows.values()].find((row) => row.name.toLowerCase() === key) ?? null;
  }

  async findById(id: string): Promise<Specialization | null> {
    return this.rows.get(id) ?? null;
  }

  async create(name: string): Promise<Specialization> {
    const row: Specialization = {
      id: `sp-${++this.seq}`,
      name,
      doctorsCount: 0,
    };
    this.rows.set(row.id, row);
    return row;
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }

  /** Тестовый хук: врач «использует» специализацию. */
  attachDoctor(id: string, count = 1): void {
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, doctorsCount: row.doctorsCount + count });
  }
}

export class InMemoryOutbox implements OutboxWriter {
  readonly events: EnqueuedEvent[] = [];

  async enqueue(routingKey: string, payload: unknown): Promise<void> {
    this.events.push({ routingKey, payload });
  }
}

/**
 * UoW без транзакции: контекст собирается из in-memory портов.
 * Атомарность (откат) unit-тест не проверяет — это уровень интеграционных тестов.
 */
export class InMemoryUnitOfWork implements UnitOfWork<SpecializationContext> {
  constructor(
    private readonly specializations: InMemorySpecializationRepository,
    private readonly outbox: InMemoryOutbox,
  ) {}

  run<T>(fn: (ctx: SpecializationContext) => Promise<T>): Promise<T> {
    return fn({ specializations: this.specializations, outbox: this.outbox });
  }
}

/** Сборка полного контекста для одного теста. */
export function makeContext(): {
  repository: InMemorySpecializationRepository;
  outbox: InMemoryOutbox;
  unitOfWork: InMemoryUnitOfWork;
} {
  const repository = new InMemorySpecializationRepository();
  const outbox = new InMemoryOutbox();
  return { repository, outbox, unitOfWork: new InMemoryUnitOfWork(repository, outbox) };
}

/**
 * In-memory репозиторий врачей (3.2): поведение совпадает с Prisma-адаптером,
 * включая очистку отчества при отсутствии middleName в данных.
 */
export class InMemoryDoctorRepository implements DoctorRepository {
  readonly rows = new Map<string, DoctorListItem>();
  private seq = 0;

  constructor(private readonly specializations: InMemorySpecializationRepository) {}

  async findPage(query: DoctorListQuery): Promise<{ items: DoctorListItem[]; total: number }> {
    let items = [...this.rows.values()];

    if (query.status) items = items.filter((row) => row.status === query.status);
    if (query.specId) items = items.filter((row) => row.specializationId === query.specId);
    const search = query.search?.trim().toLowerCase();
    if (search) {
      items = items.filter((row) =>
        `${row.lastName} ${row.firstName} ${row.middleName ?? ''}`.toLowerCase().includes(search),
      );
    }

    items.sort(
      (a, b) =>
        a.lastName.localeCompare(b.lastName, 'ru') || a.firstName.localeCompare(b.firstName, 'ru'),
    );
    const total = items.length;
    return { items: items.slice(query.offset, query.offset + query.limit), total };
  }

  async findById(id: string): Promise<DoctorListItem | null> {
    return this.rows.get(id) ?? null;
  }

  async findByUserId(userId: string): Promise<DoctorListItem | null> {
    return [...this.rows.values()].find((row) => row.userId === userId) ?? null;
  }

  async create(data: CreateDoctorData): Promise<DoctorListItem> {
    const spec = await this.specializations.findById(data.specializationId);
    const row: DoctorListItem = {
      id: `doc-${++this.seq}`,
      ...(data.userId ? { userId: data.userId } : {}),
      firstName: data.firstName,
      lastName: data.lastName,
      ...(data.middleName ? { middleName: data.middleName } : {}),
      specializationId: data.specializationId,
      specializationName: spec?.name ?? 'Неизвестная специализация',
      status: data.status ?? 'ACTIVE',
      schedule: data.schedule,
    };
    this.rows.set(row.id, row);
    return row;
  }

  async update(id: string, data: UpdateDoctorData): Promise<DoctorListItem> {
    const prev = this.rows.get(id);
    if (!prev) throw new Error(`врач ${id} не существует (настройка теста)`);

    const spec = await this.specializations.findById(data.specializationId);
    const row: DoctorListItem = {
      ...prev,
      firstName: data.firstName,
      lastName: data.lastName,
      specializationId: data.specializationId,
      specializationName: spec?.name ?? 'Неизвестная специализация',
      schedule: data.schedule,
      ...(data.middleName ? { middleName: data.middleName } : {}),
      ...(data.status ? { status: data.status } : {}),
    };
    // Явная очистка отчества: middleName отсутствует в данных (как в Prisma)
    if (!data.middleName) delete row.middleName;
    this.rows.set(id, row);
    return row;
  }

  async setPhoto(id: string, key: string | null): Promise<DoctorListItem | null> {
    const prev = this.rows.get(id);
    if (!prev) return null;
    // Локальная копия с изменяемым photoKey (доменный интерфейс readonly)
    const row = { ...prev } as { photoKey?: string };
    if (key === null) delete row.photoKey;
    else row.photoKey = key;
    this.rows.set(id, row);
    return row;
  }

  async updateSchedule(id: string, schedule: DoctorSchedule): Promise<DoctorListItem> {
    const prev = this.rows.get(id);
    if (!prev) throw new Error(`врач ${id} не существует (настройка теста)`);
    const row: DoctorListItem = { ...prev, schedule };
    this.rows.set(id, row);
    return row;
  }
}

/**
 * UoW без транзакции для слайсов врача (3.2): карточка + outbox.
 * Атомарность проверяется интеграционными тестами (0.7).
 */
export class InMemoryDoctorUnitOfWork implements UnitOfWork<DoctorContext> {
  constructor(
    private readonly doctors: InMemoryDoctorRepository,
    private readonly outbox: InMemoryOutbox,
  ) {}

  run<T>(fn: (ctx: DoctorContext) => Promise<T>): Promise<T> {
    return fn({ doctors: this.doctors, outbox: this.outbox });
  }
}

/** Сборка контекста (врачи + справочник отдельным портом) для одного теста. */
export function makeCatalogContext(): {
  specializations: InMemorySpecializationRepository;
  doctors: InMemoryDoctorRepository;
  outbox: InMemoryOutbox;
  unitOfWork: UnitOfWork<DoctorContext>;
} {
  const specializations = new InMemorySpecializationRepository();
  const doctors = new InMemoryDoctorRepository(specializations);
  const outbox = new InMemoryOutbox();
  return {
    specializations,
    doctors,
    outbox,
    unitOfWork: new InMemoryDoctorUnitOfWork(doctors, outbox),
  };
}
