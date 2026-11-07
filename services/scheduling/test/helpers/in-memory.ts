import type { Patient, PaginationQuery } from '@mp/contracts';
import type {
  Appointment,
  AppointmentContext,
  AppointmentPageQuery,
  AppointmentRepository,
  CreateAppointmentData,
} from '../../src/entities/appointment';
import type {
  CreateVisitResultData,
  VisitResult,
  VisitResultRepository,
} from '../../src/entities/visit-result';
import type {
  DoctorEventData,
  DoctorScheduleCopy,
  ScheduleCopyRepository,
} from '../../src/entities/schedule-copy';
import type { UnitOfWork } from '../../src/entities/repository';
import type { OutboxWriter } from '../../src/shared/model';
import { ConflictError, SlotTakenError } from '../../src/shared/model';
import type { MyAppointmentsPatientPort } from '../../src/features/get-my-appointments/app/get-my-appointments';
import type { BookPatientPort } from '../../src/features/book-appointment/app/book-appointment';

/**
 * In-memory реализации портов scheduling для unit-тестов (0.7 AC:
 * тесты без PostgreSQL/RabbitMQ/соседних сервисов).
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

export class InMemoryScheduleCopyRepository implements ScheduleCopyRepository {
  readonly rows = new Map<string, DoctorScheduleCopy>();

  async applyDoctorEvent(data: DoctorEventData): Promise<{ applied: boolean }> {
    const sourceAt = new Date(data.occurredAt).getTime();
    const existing = this.rows.get(data.doctorId);
    if (existing && new Date(existing.sourceAt).getTime() > sourceAt) {
      return { applied: false }; // копия свежее события
    }
    this.rows.set(data.doctorId, {
      doctorId: data.doctorId,
      userId: data.userId ?? null,
      specializationId: data.specializationId,
      specializationName: data.specializationName,
      lastName: data.lastName,
      firstName: data.firstName,
      ...(data.middleName ? { middleName: data.middleName } : {}),
      status: data.status,
      startTime: data.schedule.startTime,
      endTime: data.schedule.endTime,
      durationMinutes: data.schedule.durationMinutes,
      workDays: data.schedule.workDays,
      sourceAt: data.occurredAt,
    });
    return { applied: true };
  }

  async findForSpecialization(specializationId: string): Promise<DoctorScheduleCopy[]> {
    return [...this.rows.values()].filter((copy) => copy.specializationId === specializationId);
  }

  async findById(doctorId: string): Promise<DoctorScheduleCopy | null> {
    return this.rows.get(doctorId) ?? null;
  }

  async findByUserId(userId: string): Promise<DoctorScheduleCopy | null> {
    return [...this.rows.values()].find((row) => row.userId === userId) ?? null;
  }

  async count(): Promise<number> {
    return this.rows.size;
  }
}

export class InMemoryAppointmentRepository implements AppointmentRepository {
  readonly rows = new Map<string, Appointment>();
  private seq = 0;

  async create(data: CreateAppointmentData): Promise<Appointment> {
    const duplicate = [...this.rows.values()].find(
      (row) =>
        row.doctorId === data.doctorId &&
        row.localDate === data.localDate &&
        row.startTime === data.startTime &&
        row.status !== 'CANCELLED',
    );
    if (duplicate) throw new SlotTakenError();

    const row: Appointment = {
      id: `ap-${++this.seq}`,
      ...data,
      status: 'SUBMITTED',
      createdAt: new Date().toISOString(),
    };
    this.rows.set(row.id, row);
    return row;
  }

  async findById(id: string): Promise<Appointment | null> {
    return this.rows.get(id) ?? null;
  }

  async updateStatus(
    id: string,
    status: Appointment['status'],
    declineReason?: string | null,
  ): Promise<Appointment | null> {
    const row = this.rows.get(id);
    if (!row) return null;
    const updated: Appointment = {
      ...row,
      status,
      ...(declineReason !== undefined ? { declineReason: declineReason ?? undefined } : {}),
    };
    if (declineReason === null) delete (updated as { declineReason?: string }).declineReason;
    this.rows.set(id, updated);
    return updated;
  }

  async findPage(query: AppointmentPageQuery): Promise<{ items: Appointment[]; total: number }> {
    let items = [...this.rows.values()];
    if (query.status) items = items.filter((row) => row.status === query.status);
    if (query.specId) items = items.filter((row) => row.specializationId === query.specId);
    if (query.doctorId) items = items.filter((row) => row.doctorId === query.doctorId);
    if (query.patientId) items = items.filter((row) => row.patientId === query.patientId);
    if (query.from) items = items.filter((row) => row.localDate >= query.from!);
    if (query.to) items = items.filter((row) => row.localDate <= query.to!);

    items.sort(
      (a, b) => b.localDate.localeCompare(a.localDate) || b.startTime.localeCompare(a.startTime),
    );
    const total = items.length;
    return { items: items.slice(query.offset, query.offset + query.limit), total };
  }

  async findBusy(
    doctorIds: readonly string[],
    from: string,
    to: string,
  ): Promise<Array<{ doctorId: string; localDate: string; startTime: string }>> {
    return [...this.rows.values()]
      .filter(
        (row) =>
          doctorIds.includes(row.doctorId) &&
          row.status !== 'CANCELLED' &&
          row.localDate >= from &&
          row.localDate <= to,
      )
      .map((row) => ({
        doctorId: row.doctorId,
        localDate: row.localDate,
        startTime: row.startTime,
      }));
  }

  async updatePatientName(patientId: string, patientName: string): Promise<number> {
    let updated = 0;
    for (const row of this.rows.values()) {
      if (row.patientId === patientId && row.patientName !== patientName) {
        this.rows.set(row.id, { ...row, patientName });
        updated += 1;
      }
    }
    return updated;
  }

  async findDistinctPatients(
    doctorId: string,
  ): Promise<Array<{ patientId: string; patientName: string; lastVisit?: string }>> {
    const seen = new Map<string, { patientId: string; patientName: string; lastVisit: string }>();
    const rows = [...this.rows.values()]
      .filter((row) => row.doctorId === doctorId)
      .sort(
        (a, b) => b.localDate.localeCompare(a.localDate) || b.startTime.localeCompare(a.startTime),
      );
    for (const row of rows) {
      if (!seen.has(row.patientId)) {
        seen.set(row.patientId, {
          patientId: row.patientId,
          patientName: row.patientName,
          lastVisit: row.localDate,
        });
      }
    }
    return [...seen.values()];
  }

  async hasRelation(doctorId: string, patientId: string): Promise<boolean> {
    return [...this.rows.values()].some(
      (row) =>
        row.doctorId === doctorId &&
        row.patientId === patientId &&
        (row.status === 'APPROVED' || row.status === 'COMPLETED'),
    );
  }

  /** Тестовый хук: прикрепить результат приёма к записи. */
  attachVisitResult(appointmentId: string, result: NonNullable<Appointment['visitResult']>): void {
    const row = this.rows.get(appointmentId);
    if (row) this.rows.set(appointmentId, { ...row, visitResult: result });
  }
}

/** In-memory репозиторий результатов приёма (9.2). */
export class InMemoryVisitResultRepository implements VisitResultRepository {
  readonly rows = new Map<string, VisitResult>();
  private seq = 0;

  constructor(private readonly appointments: InMemoryAppointmentRepository) {}

  /** Результат в записи — как include в Prisma (списки/история отдают visitResult). */
  private attach(appointmentId: string, result: VisitResult): void {
    this.appointments.attachVisitResult(appointmentId, {
      conclusion: result.conclusion,
      ...(result.recommendations ? { recommendations: result.recommendations } : {}),
    });
  }

  async findByAppointmentId(appointmentId: string): Promise<VisitResult | null> {
    return this.rows.get(appointmentId) ?? null;
  }

  async create(data: CreateVisitResultData): Promise<VisitResult> {
    if (this.rows.has(data.appointmentId)) {
      throw new ConflictError('Результат приёма уже внесён', { code: 'RESULT_EXISTS' });
    }
    const row: VisitResult = {
      id: `vr-${++this.seq}`,
      appointmentId: data.appointmentId,
      conclusion: data.conclusion,
      ...(data.recommendations ? { recommendations: data.recommendations } : {}),
      createdBy: data.createdBy,
      updatedAt: new Date().toISOString(),
    };
    this.rows.set(row.appointmentId, row);
    this.attach(row.appointmentId, row);
    return row;
  }

  async update(
    appointmentId: string,
    data: { conclusion: string; recommendations?: string },
  ): Promise<VisitResult | null> {
    const row = this.rows.get(appointmentId);
    if (!row) return null;
    const next: VisitResult = {
      ...row,
      conclusion: data.conclusion,
      updatedAt: new Date().toISOString(),
    };
    if (data.recommendations) next.recommendations = data.recommendations;
    else delete next.recommendations;
    this.rows.set(appointmentId, next);
    this.attach(appointmentId, next);
    return next;
  }
}

export class InMemoryUnitOfWork implements UnitOfWork<AppointmentContext> {
  /** Тестовый хук: бросить ошибку на следующем run (сбой транзакции). */
  failNextRun: Error | null = null;

  constructor(
    private readonly appointments: InMemoryAppointmentRepository,
    private readonly visitResults: InMemoryVisitResultRepository,
    private readonly outbox: InMemoryOutbox,
  ) {}

  run<T>(fn: (ctx: AppointmentContext) => Promise<T>): Promise<T> {
    if (this.failNextRun) {
      const error = this.failNextRun;
      this.failNextRun = null;
      return Promise.reject(error);
    }
    return fn({
      appointments: this.appointments,
      visitResults: this.visitResults,
      outbox: this.outbox,
    });
  }
}

/** Порт пациентов: sub → карточка; id → карточка. */
export class InMemoryPatients implements BookPatientPort, MyAppointmentsPatientPort {
  readonly bySub = new Map<string, Patient>();
  readonly byId = new Map<string, Patient>();

  add(patient: Patient): void {
    this.byId.set(patient.id, patient);
    this.bySub.set(patient.userId, patient);
  }

  async findByUser(userId: string): Promise<Patient | null> {
    return this.bySub.get(userId) ?? null;
  }

  async findById(patientId: string): Promise<Patient | null> {
    return this.byId.get(patientId) ?? null;
  }
}

export function makeSchedulingContext(): {
  copies: InMemoryScheduleCopyRepository;
  appointments: InMemoryAppointmentRepository;
  visitResults: InMemoryVisitResultRepository;
  outbox: InMemoryOutbox;
  patients: InMemoryPatients;
  unitOfWork: InMemoryUnitOfWork;
} {
  const appointments = new InMemoryAppointmentRepository();
  const visitResults = new InMemoryVisitResultRepository(appointments);
  const outbox = new InMemoryOutbox();
  return {
    copies: new InMemoryScheduleCopyRepository(),
    appointments,
    visitResults,
    outbox,
    patients: new InMemoryPatients(),
    unitOfWork: new InMemoryUnitOfWork(appointments, visitResults, outbox),
  };
}

/** Детерминированные «часы» для тестов. */
export function fixedNow(iso: string): () => Date {
  return () => new Date(iso);
}

export type { PaginationQuery };
