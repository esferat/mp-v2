import type {
  CreateVisitResultData,
  VisitResult,
  VisitResultRepository,
} from '../../entities/visit-result';
import type { Prisma } from '../../generated/prisma/client';
import { ConflictError } from '../model';
import { PrismaService } from './prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

interface VisitResultRow {
  id: string;
  appointmentId: string;
  conclusion: string;
  recommendations: string | null;
  createdBy: string;
  updatedAt: Date;
}

function toDomain(row: VisitResultRow): VisitResult {
  return {
    id: row.id,
    appointmentId: row.appointmentId,
    conclusion: row.conclusion,
    ...(row.recommendations ? { recommendations: row.recommendations } : {}),
    createdBy: row.createdBy,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Prisma-реализация порта VisitResultRepository (9.2). */
export class PrismaVisitResultRepository implements VisitResultRepository {
  constructor(private readonly db: Db) {}

  async findByAppointmentId(appointmentId: string): Promise<VisitResult | null> {
    const row = await this.db.visitResult.findUnique({ where: { appointmentId } });
    return row ? toDomain(row) : null;
  }

  async create(data: CreateVisitResultData): Promise<VisitResult> {
    try {
      const row = await this.db.visitResult.create({
        data: {
          appointmentId: data.appointmentId,
          conclusion: data.conclusion,
          recommendations: data.recommendations ?? null,
          createdBy: data.createdBy,
        },
      });
      return toDomain(row);
    } catch (error) {
      if (hasCode(error, 'P2002')) {
        // Гонка параллельных submit: результат уже внесён другим запросом
        throw new ConflictError('Результат приёма уже внесён', { code: 'RESULT_EXISTS' });
      }
      throw error;
    }
  }

  async update(
    appointmentId: string,
    data: { conclusion: string; recommendations?: string },
  ): Promise<VisitResult | null> {
    try {
      const row = await this.db.visitResult.update({
        where: { appointmentId },
        data: {
          conclusion: data.conclusion,
          recommendations: data.recommendations ?? null,
        },
      });
      return toDomain(row);
    } catch (error) {
      if (hasCode(error, 'P2025')) return null;
      throw error;
    }
  }
}

function hasCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}
