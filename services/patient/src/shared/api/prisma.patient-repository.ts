import { ConflictError } from '../model';
import type { Patient, PatientRepository } from '../../entities/patient';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from './prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

/** Prisma-строка карточки. */
interface PatientRow {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  birthDate: Date;
  registeredAt: Date;
}

function toDomain(row: PatientRow): Patient {
  return {
    id: row.id,
    userId: row.userId,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    ...(row.middleName ? { middleName: row.middleName } : {}),
    birthDate: row.birthDate.toISOString().slice(0, 10),
    registeredAt: row.registeredAt.toISOString(),
  };
}

/**
 * Prisma-реализация порта PatientRepository (адаптер, fsd.md §4.4).
 * Идемпотентность саги (1.4 AC) держится на уникальных индексах userId/email:
 * гонка двойного submit гасится Prisma-исключением P2002 → возвращаем существующую.
 */
export class PrismaPatientRepository implements PatientRepository {
  constructor(private readonly db: Db) {}

  async findByUserId(userId: string): Promise<Patient | null> {
    const row = await this.db.patient.findUnique({ where: { userId } });
    return row ? toDomain(row) : null;
  }

  async createIfAbsent(data: Omit<Patient, 'id' | 'registeredAt'>): Promise<Patient> {
    try {
      const row = await this.db.patient.create({
        data: {
          userId: data.userId,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          middleName: data.middleName,
          birthDate: new Date(`${data.birthDate}T00:00:00.000Z`),
        },
      });
      return toDomain(row);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      // Уже есть карточка с этим userId → повтор/гонка: возвращаем её (1.4 AC)
      const existing = await this.db.patient.findUnique({ where: { userId: data.userId } });
      if (existing) return toDomain(existing);

      // email занят другой учётной записью — это конфликт, а не дубль
      throw new ConflictError(`Email ${data.email} уже привязан к другому пациенту`, {
        field: 'email',
      });
    }
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
