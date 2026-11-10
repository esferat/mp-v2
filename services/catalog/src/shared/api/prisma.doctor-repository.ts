import type {
  CreateDoctorData,
  DoctorListItem,
  DoctorListQuery,
  DoctorRepository,
  DoctorSchedule,
  DoctorStatus,
  UpdateDoctorData,
} from '../../entities/doctor';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from './prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

/** Prisma-строка врача с названием специализации. */
interface DoctorRow {
  id: string;
  userId: string | null;
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

/** JOIN специализации: название нужно и списку, и событиям (3.5). */
const includeSpec = { specialization: { select: { name: true } } } as const;

function toDomain(row: DoctorRow): DoctorListItem {
  const schedule: DoctorSchedule = {
    startTime: row.scheduleStart,
    endTime: row.scheduleEnd,
    durationMinutes: row.durationMinutes,
    workDays: row.workDays,
  };

  return {
    id: row.id,
    userId: row.userId,
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
 * Данные формы в колонки: единственная точка маппинга create/update (DRY).
 * middleName: null при отсутствии — явная очистка отчества при редактировании.
 */
function toRowData(data: CreateDoctorData | UpdateDoctorData): Prisma.DoctorUncheckedCreateInput {
  return {
    ...(data.userId !== undefined ? { userId: data.userId } : {}),
    firstName: data.firstName,
    lastName: data.lastName,
    middleName: data.middleName ?? null,
    specializationId: data.specializationId,
    scheduleStart: data.schedule.startTime,
    scheduleEnd: data.schedule.endTime,
    durationMinutes: data.schedule.durationMinutes,
    workDays: data.schedule.workDays,
    ...(data.status ? { status: data.status } : {}),
  };
}

/**
 * Prisma-реализация порта DoctorRepository (3.1/3.2).
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
        include: includeSpec,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: query.offset,
        take: query.limit,
      }),
      this.db.doctor.count({ where }),
    ]);

    return { items: rows.map(toDomain), total };
  }

  async findById(id: string): Promise<DoctorListItem | null> {
    const row = await this.db.doctor.findUnique({ where: { id }, include: includeSpec });
    return row ? toDomain(row) : null;
  }

  async findByUserId(userId: string): Promise<DoctorListItem | null> {
    const row = await this.db.doctor.findUnique({ where: { userId }, include: includeSpec });
    return row ? toDomain(row) : null;
  }

  async create(data: CreateDoctorData): Promise<DoctorListItem> {
    const row = await this.db.doctor.create({
      data: toRowData(data),
      include: includeSpec,
    });
    return toDomain(row);
  }

  async update(id: string, data: UpdateDoctorData): Promise<DoctorListItem> {
    const row = await this.db.doctor.update({
      where: { id },
      data: toRowData(data),
      include: includeSpec,
    });
    return toDomain(row);
  }

  async updateSchedule(id: string, schedule: DoctorSchedule): Promise<DoctorListItem> {
    // Только колонки расписания (10.4): ФИО/специализация/статус не трогаем
    const row = await this.db.doctor.update({
      where: { id },
      data: {
        scheduleStart: schedule.startTime,
        scheduleEnd: schedule.endTime,
        durationMinutes: schedule.durationMinutes,
        workDays: schedule.workDays,
      },
      include: includeSpec,
    });
    return toDomain(row);
  }

  async setPhoto(id: string, key: string | null): Promise<DoctorListItem | null> {
    try {
      const row = await this.db.doctor.update({
        where: { id },
        data: { photoKey: key },
        include: includeSpec,
      });
      return toDomain(row);
    } catch (error) {
      if (isRecordMissing(error)) return null;
      throw error;
    }
  }
}

/** P2025: запись не найдена (гонка удаления). */
function isRecordMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2025'
  );
}

/**
 * Фильтры списка врачей (3.1): поиск по ФИО (без учёта регистра), статус,
 * специализация. Экспортируется для unit-теста — Prisma-WHERE проверяется без БД.
 */
export function buildWhere(query: DoctorListQuery): Prisma.DoctorWhereInput {
  const where: Prisma.DoctorWhereInput = {};

  if (query.status) where.status = query.status;
  if (query.specId) where.specializationId = query.specId;

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
