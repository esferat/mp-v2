import type {
  DoctorListItem,
  DoctorListQuery,
  DoctorRepository,
  DoctorSchedule,
  DoctorStatus,
} from '../../entities/doctor';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from './prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

/** Prisma-строка врача с названием специализации. */
interface DoctorRow {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  status: string;
  photoKey: string | null;
  scheduleStart: string;
  scheduleEnd: string;
  durationMinutes: number;
  workDays: number[];
  specializationId: string;
  specialization: { name: string };
}

function toDomain(row: DoctorRow): DoctorListItem {
  const schedule: DoctorSchedule = {
    startTime: row.scheduleStart,
    endTime: row.scheduleEnd,
    durationMinutes: row.durationMinutes,
    workDays: row.workDays,
  };

  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    ...(row.middleName ? { middleName: row.middleName } : {}),
    specializationId: row.specializationId,
    specializationName: row.specialization.name,
    status: row.status as DoctorStatus,
    schedule,
    ...(row.photoKey ? { photoKey: row.photoKey } : {}),
    // photoUrl подписывается в use-case (presigned, TTL 5 мин — 0.5)
  };
}

/**
 * Prisma-реализация порта DoctorRepository (3.1).
 *
 * Поиск по ФИО — ILIKE (mode: insensitive, Prisma сам экранирует шаблон);
 * триграммный GIN-индекс (pg_trgm, миграция 2_search) ускоряет его на больших
 * объёмах. «Сравнить, выбрать»: ILIKE+trgm выбран как простой и предсказуемый
 * для русских ФИО против GIN-полнотекстового с русским словарём (см. отчёт).
 */
export class PrismaDoctorRepository implements DoctorRepository {
  constructor(private readonly db: Db) {}

  async findPage(query: DoctorListQuery): Promise<{ items: DoctorListItem[]; total: number }> {
    const where = buildWhere(query);

    const [rows, total] = await Promise.all([
      this.db.doctor.findMany({
        where,
        include: { specialization: { select: { name: true } } },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: query.offset,
        take: query.limit,
      }),
      this.db.doctor.count({ where }),
    ]);

    return { items: rows.map(toDomain), total };
  }
}

/** Фильтры: поиск по ФИО (без учёта регистра), статус. */
function buildWhere(query: DoctorListQuery): Prisma.DoctorWhereInput {
  const where: Prisma.DoctorWhereInput = {};

  if (query.status) where.status = query.status;

  const search = query.search?.trim();
  if (search) {
    where.OR = [
      { lastName: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { middleName: { contains: search, mode: 'insensitive' } },
    ];
  }

  return where;
}
