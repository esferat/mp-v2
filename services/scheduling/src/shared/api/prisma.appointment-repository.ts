import type { AppointmentStatus } from '@mp/contracts';
import type {
  Appointment,
  AppointmentPageQuery,
  AppointmentRepository,
  CreateAppointmentData,
} from '../../entities/appointment';
import type { Prisma } from '../../generated/prisma/client';
import { SlotTakenError } from '../model';
import { PrismaService } from './prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

interface AppointmentRow {
  id: string;
  doctorId: string;
  doctorName: string;
  specializationId: string;
  specializationName: string;
  patientId: string;
  patientName: string;
  startTime: string;
  endTime: string;
  localDate: Date;
  status: string;
  declineReason: string | null;
  createdAt: Date;
  visitResult: { conclusion: string; recommendations: string | null } | null;
}

function toDomain(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    doctorId: row.doctorId,
    doctorName: row.doctorName,
    specializationId: row.specializationId,
    specializationName: row.specializationName,
    patientId: row.patientId,
    patientName: row.patientName,
    startTime: row.startTime,
    endTime: row.endTime,
    localDate: row.localDate.toISOString().slice(0, 10),
    status: row.status as AppointmentStatus,
    ...(row.declineReason ? { declineReason: row.declineReason } : {}),
    createdAt: row.createdAt.toISOString(),
    ...(row.visitResult
      ? {
          visitResult: {
            conclusion: row.visitResult.conclusion,
            ...(row.visitResult.recommendations
              ? { recommendations: row.visitResult.recommendations }
              : {}),
          },
        }
      : {}),
  };
}

/** Результаты приёма подтягиваются списками (5.5/9.2: история read-only). */
const includeVisitResult = {
  visitResult: { select: { conclusion: true, recommendations: true } },
} as const;

/**
 * Prisma-реализация порта AppointmentRepository (5.3/5.4).
 *
 * Двойная защита от дублей слота: частичный уникальный индекс
 * (doctorId, localDate, startTime) WHERE status <> 'CANCELLED' из миграции —
 * при нарушении Prisma бросает P2002, здесь он маппится в 409 SLOT_TAKEN (AC 5.3).
 */
export class PrismaAppointmentRepository implements AppointmentRepository {
  constructor(private readonly db: Db) {}

  async create(data: CreateAppointmentData): Promise<Appointment> {
    try {
      const row = await this.db.appointment.create({
        data: {
          doctorId: data.doctorId,
          doctorName: data.doctorName,
          specializationId: data.specializationId,
          specializationName: data.specializationName,
          patientId: data.patientId,
          patientName: data.patientName,
          startTime: data.startTime,
          endTime: data.endTime,
          localDate: new Date(`${data.localDate}T00:00:00.000Z`),
        },
        include: includeVisitResult,
      });
      return toDomain(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new SlotTakenError();
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Appointment | null> {
    const row = await this.db.appointment.findUnique({
      where: { id },
      include: includeVisitResult,
    });
    return row ? toDomain(row) : null;
  }

  async updateStatus(
    id: string,
    status: AppointmentStatus,
    declineReason?: string | null,
  ): Promise<Appointment | null> {
    try {
      const row = await this.db.appointment.update({
        where: { id },
        data: {
          status,
          ...(declineReason !== undefined ? { declineReason } : {}),
        },
        include: includeVisitResult,
      });
      return toDomain(row);
    } catch (error) {
      if (isRecordMissing(error)) return null;
      throw error;
    }
  }

  async findPage(query: AppointmentPageQuery): Promise<{ items: Appointment[]; total: number }> {
    const where: Prisma.AppointmentWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.specId ? { specializationId: query.specId } : {}),
      ...(query.doctorId ? { doctorId: query.doctorId } : {}),
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.from || query.to
        ? {
            localDate: {
              ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
              ...(query.to ? { lte: new Date(`${query.to}T00:00:00.000Z`) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.db.appointment.findMany({
        where,
        include: includeVisitResult,
        orderBy: [{ localDate: 'desc' }, { startTime: 'desc' }],
        skip: query.offset,
        take: query.limit,
      }),
      this.db.appointment.count({ where }),
    ]);

    return { items: rows.map(toDomain), total };
  }

  async findDistinctPatients(
    doctorId: string,
  ): Promise<Array<{ patientId: string; patientName: string; lastVisit?: string }>> {
    const rows = await this.db.appointment.findMany({
      where: { doctorId },
      orderBy: [{ localDate: 'desc' }, { startTime: 'desc' }],
      select: { patientId: true, patientName: true, localDate: true },
    });

    const seen = new Map<string, { patientId: string; patientName: string; lastVisit: string }>();
    for (const row of rows) {
      if (!seen.has(row.patientId)) {
        seen.set(row.patientId, {
          patientId: row.patientId,
          patientName: row.patientName,
          lastVisit: row.localDate.toISOString().slice(0, 10),
        });
      }
    }
    return [...seen.values()];
  }

  async findBusy(
    doctorIds: readonly string[],
    from: string,
    to: string,
  ): Promise<Array<{ doctorId: string; localDate: string; startTime: string }>> {
    if (doctorIds.length === 0) return [];
    const rows = await this.db.appointment.findMany({
      where: {
        doctorId: { in: [...doctorIds] },
        status: { not: 'CANCELLED' },
        localDate: {
          gte: new Date(`${from}T00:00:00.000Z`),
          lte: new Date(`${to}T00:00:00.000Z`),
        },
      },
      select: { doctorId: true, localDate: true, startTime: true },
    });
    return rows.map((row) => ({
      doctorId: row.doctorId,
      localDate: row.localDate.toISOString().slice(0, 10),
      startTime: row.startTime,
    }));
  }

  async updatePatientName(patientId: string, patientName: string): Promise<number> {
    const result = await this.db.appointment.updateMany({
      where: { patientId },
      data: { patientName },
    });
    return result.count;
  }

  async hasRelation(doctorId: string, patientId: string): Promise<boolean> {
    const row = await this.db.appointment.findFirst({
      where: { doctorId, patientId, status: { in: ['APPROVED', 'COMPLETED'] } },
      select: { id: true },
    });
    return row !== null;
  }
}

/** P2002 — нарушение уникального индекса (дубль слота). */
function isUniqueViolation(error: unknown): boolean {
  return hasCode(error, 'P2002');
}

/** P2025 — запись не найдена. */
function isRecordMissing(error: unknown): boolean {
  return hasCode(error, 'P2025');
}

function hasCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}
