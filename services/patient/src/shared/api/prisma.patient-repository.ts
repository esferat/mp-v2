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
  photoKey: string | null;
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
    ...(row.photoKey ? { photoKey: row.photoKey } : {}),
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

  async findById(id: string): Promise<Patient | null> {
    const row = await this.db.patient.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async setPhoto(id: string, key: string | null): Promise<Patient | null> {
    try {
      const row = await this.db.patient.update({ where: { id }, data: { photoKey: key } });
      return toDomain(row);
    } catch (error) {
      if (isRecordMissing(error)) return null; // P2025: карточки нет (гонка удаления)
      throw error;
    }
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
    try {
      const row = await this.db.patient.update({
        where: { id },
        data: {
          email: data.email.toLowerCase(),
          firstName: data.firstName,
          lastName: data.lastName,
          middleName: data.middleName ?? null,
          birthDate: new Date(`${data.birthDate}T00:00:00.000Z`),
        },
      });
      return toDomain(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(`Email ${data.email} уже привязан к другому пациенту`, {
          field: 'email',
        });
      }
      throw error;
    }
  }

  async findPage(query: {
    offset: number;
    limit: number;
    search?: string;
  }): Promise<{ items: Patient[]; total: number }> {
    const search = query.search?.trim();
    const where: Prisma.PatientWhereInput = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { middleName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [rows, total] = await Promise.all([
      this.db.patient.findMany({
        where,
        orderBy: [{ registeredAt: 'desc' }],
        skip: query.offset,
        take: query.limit,
      }),
      this.db.patient.count({ where }),
    ]);

    return { items: rows.map(toDomain), total };
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
  return hasPrismaCode(error, 'P2002');
}

/** P2025 — запись не найдена (повторное удаление/обновление). */
function isRecordMissing(error: unknown): boolean {
  return hasPrismaCode(error, 'P2025');
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}
