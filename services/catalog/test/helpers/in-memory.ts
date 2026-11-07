import type {
  Specialization,
  SpecializationContext,
  SpecializationRepository,
} from '../src/entities/specialization';
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
