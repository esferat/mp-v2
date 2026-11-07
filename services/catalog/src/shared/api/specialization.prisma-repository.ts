import { ConflictError } from '../model';
import type { Specialization, SpecializationRepository } from '../../entities/specialization';
import { specializationKey } from '../../entities/specialization';
import type { PrismaService } from './prisma.service';
import type { Prisma } from '../../generated/prisma/client';

/** Prisma-строка специализации со счётчиком врачей. */
interface SpecializationRow {
  id: string;
  name: string;
  _count?: { doctors: number };
}

type Db = PrismaService | Prisma.TransactionClient;

const withCount = { _count: { select: { doctors: true } } } as const;

function toDomain(row: SpecializationRow): Specialization {
  return {
    id: row.id,
    name: row.name,
    doctorsCount: row._count?.doctors ?? 0,
  };
}

/**
 * Prisma-реализация порта SpecializationRepository.
 * Работает и с корневым клиентом (чтения), и с транзакционным (записи в UoW).
 */
export class PrismaSpecializationRepository implements SpecializationRepository {
  constructor(private readonly db: Db) {}

  async findAll(): Promise<Specialization[]> {
    const rows = await this.db.specialization.findMany({
      orderBy: { name: 'asc' },
      include: withCount,
    });
    return rows.map(toDomain);
  }

  async findByName(name: string): Promise<Specialization | null> {
    const row = await this.db.specialization.findFirst({
      where: { nameLower: specializationKey(name) },
      include: withCount,
    });
    return row ? toDomain(row) : null;
  }

  async findById(id: string): Promise<Specialization | null> {
    const row = await this.db.specialization.findUnique({
      where: { id },
      include: withCount,
    });
    return row ? toDomain(row) : null;
  }

  async create(name: string): Promise<Specialization> {
    try {
      const row = await this.db.specialization.create({
        data: { name, nameLower: specializationKey(name) },
        include: withCount,
      });
      return toDomain(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(`Специализация «${name}» уже существует`, { field: 'name' });
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.db.specialization.delete({ where: { id } });
  }
}

/** P2002 — нарушение уникального индекса (Prisma error code). */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
