import type { OwnerType } from '@mp/contracts';
import type { AccessPorts } from '../../src/entities/access';
import type {
  CreateFileData,
  FileContext,
  FileMeta,
  FileRepository,
  ObjectStore,
  PhotoLinker,
} from '../../src/entities/file';
import type { UnitOfWork } from '../../src/entities/repository';
import type { OutboxWriter } from '../../src/shared/model';

/**
 * In-memory реализации портов для unit-тестов file-service (0.7 AC:
 * тесты без инфраструктуры: без БД, MinIO и соседних сервисов).
 */

export interface EnqueuedEvent {
  routingKey: string;
  payload: unknown;
}

export class InMemoryOutbox implements OutboxWriter {
  readonly events: EnqueuedEvent[] = [];

  async enqueue(routingKey: string, payload: unknown): Promise<void> {
    this.events.push({ routingKey, payload });
  }
}

export class InMemoryFileRepository implements FileRepository {
  readonly rows = new Map<string, FileMeta>();
  private seq = 0;

  async findByKey(key: string): Promise<FileMeta | null> {
    return this.rows.get(key) ?? null;
  }

  async create(data: CreateFileData): Promise<FileMeta> {
    const row: FileMeta = {
      id: `file-${++this.seq}`,
      key: data.key,
      bucket: data.bucket,
      ownerType: data.ownerType,
      ownerId: data.ownerId,
      mime: data.mime,
      size: data.size,
      uploadedBy: data.uploadedBy,
      ...(data.category ? { category: data.category } : {}),
      createdAt: new Date().toISOString(),
    };
    this.rows.set(row.key, row);
    return row;
  }

  async deleteByKey(key: string): Promise<boolean> {
    return this.rows.delete(key);
  }

  async findByOwner(
    ownerType: FileMeta['ownerType'],
    ownerId: string,
  ): Promise<{ items: FileMeta[]; total: number }> {
    const items = [...this.rows.values()]
      .filter((row) => row.ownerType === ownerType && row.ownerId === ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { items, total: items.length };
  }
}

export class InMemoryObjectStore implements ObjectStore {
  readonly objects = new Map<string, Uint8Array>();
  /** Тестовый хук: бросить ошибку на следующем put/remove. */
  failNextPut: Error | null = null;
  failNextRemove: Error | null = null;

  async put(request: {
    bucket: string;
    key: string;
    body: Uint8Array;
    contentType: string;
  }): Promise<void> {
    if (this.failNextPut) {
      const error = this.failNextPut;
      this.failNextPut = null;
      throw error;
    }
    this.objects.set(`${request.bucket}/${request.key}`, request.body);
  }

  async remove(bucket: string, key: string): Promise<void> {
    if (this.failNextRemove) {
      const error = this.failNextRemove;
      this.failNextRemove = null;
      throw error;
    }
    this.objects.delete(`${bucket}/${key}`);
  }

  has(bucket: string, key: string): boolean {
    return this.objects.has(`${bucket}/${key}`);
  }
}

export class InMemoryAccess implements AccessPorts {
  /** userId (Keycloak sub) → patient.id. */
  readonly patients = new Map<string, string>();
  /** `${doctorUserId}|${patientId}` → есть действующая связь (9.3). */
  readonly relations = new Set<string>();
  /** userId (Keycloak sub) → doctor.id (9.3, файлы самого врача). */
  readonly doctors = new Map<string, string>();

  async findPatientByUser(userId: string): Promise<{ id: string } | null> {
    const id = this.patients.get(userId);
    return id ? { id } : null;
  }

  async hasDoctorRelation(doctorUserId: string, patientId: string): Promise<boolean> {
    return this.relations.has(`${doctorUserId}|${patientId}`);
  }

  async findDoctorByUser(userId: string): Promise<{ id: string } | null> {
    const id = this.doctors.get(userId);
    return id ? { id } : null;
  }
}

export class InMemoryPhotoLinker implements PhotoLinker {
  /** "OWNER:ownerId" → текущий photoKey. */
  readonly photos = new Map<string, string>();
  readonly calls: Array<{ ownerType: OwnerType; ownerId: string; key: string | null }> = [];
  failNextLink: Error | null = null;

  async link(
    ownerType: OwnerType,
    ownerId: string,
    key: string | null,
  ): Promise<{ previousKey: string | null }> {
    this.calls.push({ ownerType, ownerId, key });
    if (this.failNextLink) {
      const error = this.failNextLink;
      this.failNextLink = null;
      throw error;
    }
    const slot = `${ownerType}:${ownerId}`;
    const previousKey = this.photos.get(slot) ?? null;
    if (key === null) this.photos.delete(slot);
    else this.photos.set(slot, key);
    return { previousKey };
  }
}

export class InMemoryUnitOfWork implements UnitOfWork<FileContext> {
  /** Тестовый хук: бросить ошибку на следующем run (сбой транзакции). */
  failNextRun: Error | null = null;

  constructor(
    private readonly files: InMemoryFileRepository,
    private readonly outbox: InMemoryOutbox,
  ) {}

  run<T>(fn: (ctx: FileContext) => Promise<T>): Promise<T> {
    if (this.failNextRun) {
      const error = this.failNextRun;
      this.failNextRun = null;
      return Promise.reject(error);
    }
    return fn({ files: this.files, outbox: this.outbox });
  }
}

export function makeFileContext(): {
  files: InMemoryFileRepository;
  outbox: InMemoryOutbox;
  store: InMemoryObjectStore;
  access: InMemoryAccess;
  photos: InMemoryPhotoLinker;
  unitOfWork: InMemoryUnitOfWork;
} {
  const files = new InMemoryFileRepository();
  const outbox = new InMemoryOutbox();
  return {
    files,
    outbox,
    store: new InMemoryObjectStore(),
    access: new InMemoryAccess(),
    photos: new InMemoryPhotoLinker(),
    unitOfWork: new InMemoryUnitOfWork(files, outbox),
  };
}
