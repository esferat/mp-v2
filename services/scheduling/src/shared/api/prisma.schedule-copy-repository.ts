import type {
  DoctorEventData,
  DoctorScheduleCopy,
  ScheduleCopyRepository,
} from '../../entities/schedule-copy';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from './prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

interface CopyRow {
  doctorId: string;
  userId: string | null;
  specializationId: string;
  specializationName: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  status: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  workDays: number[];
  sourceAt: Date;
}

function toDomain(row: CopyRow): DoctorScheduleCopy {
  return {
    doctorId: row.doctorId,
    userId: row.userId,
    specializationId: row.specializationId,
    specializationName: row.specializationName,
    lastName: row.lastName,
    firstName: row.firstName,
    ...(row.middleName ? { middleName: row.middleName } : {}),
    status: row.status as DoctorScheduleCopy['status'],
    startTime: row.startTime,
    endTime: row.endTime,
    durationMinutes: row.durationMinutes,
    workDays: row.workDays,
    sourceAt: row.sourceAt.toISOString(),
  };
}

function toRowData(data: DoctorEventData): {
  userId: string | null;
  specializationId: string;
  specializationName: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  status: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  workDays: number[];
  sourceAt: Date;
} {
  return {
    userId: data.userId ?? null,
    specializationId: data.specializationId,
    specializationName: data.specializationName,
    lastName: data.lastName,
    firstName: data.firstName,
    middleName: data.middleName ?? null,
    status: data.status,
    startTime: data.schedule.startTime,
    endTime: data.schedule.endTime,
    durationMinutes: data.schedule.durationMinutes,
    workDays: data.schedule.workDays,
    sourceAt: new Date(data.occurredAt),
  };
}

/**
 * Prisma-реализация порта ScheduleCopyRepository (5.1).
 *
 * Идемпотентность применений (3.5/5.1 AC): апсерт условием
 * `sourceAt <= occurredAt` — повтор события и гонка порядка не перезаписывают
 * более свежую копию.
 */
export class PrismaScheduleCopyRepository implements ScheduleCopyRepository {
  constructor(private readonly db: Db) {}

  async applyDoctorEvent(data: DoctorEventData): Promise<{ applied: boolean }> {
    const rowData = toRowData(data);

    const updated = await this.db.doctorScheduleCopy.updateMany({
      where: { doctorId: data.doctorId, sourceAt: { lte: rowData.sourceAt } },
      data: rowData,
    });
    if (updated.count > 0) return { applied: true };

    const existing = await this.db.doctorScheduleCopy.findUnique({
      where: { doctorId: data.doctorId },
    });
    if (existing) return { applied: false }; // копия свежее события

    try {
      await this.db.doctorScheduleCopy.create({ data: { doctorId: data.doctorId, ...rowData } });
      return { applied: true };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Гонка параллельного создания: применяем условный апсерт повторно
      const retry = await this.db.doctorScheduleCopy.updateMany({
        where: { doctorId: data.doctorId, sourceAt: { lte: rowData.sourceAt } },
        data: rowData,
      });
      return { applied: retry.count > 0 };
    }
  }

  async findForSpecialization(specializationId: string): Promise<DoctorScheduleCopy[]> {
    const rows = await this.db.doctorScheduleCopy.findMany({ where: { specializationId } });
    return rows.map(toDomain);
  }

  async findById(doctorId: string): Promise<DoctorScheduleCopy | null> {
    const row = await this.db.doctorScheduleCopy.findUnique({ where: { doctorId } });
    return row ? toDomain(row) : null;
  }

  async findByUserId(userId: string): Promise<DoctorScheduleCopy | null> {
    const row = await this.db.doctorScheduleCopy.findFirst({ where: { userId } });
    return row ? toDomain(row) : null;
  }

  async count(): Promise<number> {
    return this.db.doctorScheduleCopy.count();
  }
}

/** P2002 — нарушение уникального индекса (гонка create). */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
