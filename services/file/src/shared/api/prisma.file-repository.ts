import type { DocumentCategory, OwnerType } from '@mp/contracts';
import type { CreateFileData, FileMeta, FileRepository } from '../../entities/file';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from './prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

/** Prisma-строка реестра файлов. */
interface FileRow {
  id: string;
  key: string;
  bucket: string;
  ownerType: string;
  ownerId: string;
  mime: string;
  size: number;
  uploadedBy: string;
  category: string | null;
  createdAt: Date;
}

function toDomain(row: FileRow): FileMeta {
  return {
    id: row.id,
    key: row.key,
    bucket: row.bucket,
    ownerType: row.ownerType as OwnerType,
    ownerId: row.ownerId,
    mime: row.mime,
    size: row.size,
    uploadedBy: row.uploadedBy,
    ...(row.category ? { category: row.category as DocumentCategory } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}

/** Prisma-реализация порта FileRepository (4.4, адаптер fsd.md §4.4). */
export class PrismaFileRepository implements FileRepository {
  constructor(private readonly db: Db) {}

  async findByKey(key: string): Promise<FileMeta | null> {
    const row = await this.db.fileObject.findUnique({ where: { key } });
    return row ? toDomain(row) : null;
  }

  async create(data: CreateFileData): Promise<FileMeta> {
    const row = await this.db.fileObject.create({
      data: {
        key: data.key,
        bucket: data.bucket,
        ownerType: data.ownerType,
        ownerId: data.ownerId,
        mime: data.mime,
        size: data.size,
        uploadedBy: data.uploadedBy,
        category: data.category ?? null,
      },
    });
    return toDomain(row);
  }

  async deleteByKey(key: string): Promise<boolean> {
    try {
      await this.db.fileObject.delete({ where: { key } });
      return true;
    } catch (error) {
      if (isRecordMissing(error)) return false;
      throw error;
    }
  }

  async findByOwner(
    ownerType: OwnerType,
    ownerId: string,
  ): Promise<{ items: FileMeta[]; total: number }> {
    const where = { ownerType, ownerId };
    const [rows, total] = await Promise.all([
      this.db.fileObject.findMany({ where, orderBy: { createdAt: 'desc' } }),
      this.db.fileObject.count({ where }),
    ]);
    return { items: rows.map(toDomain), total };
  }
}

/** P2025: запись не найдена (повторное удаление). */
function isRecordMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2025'
  );
}
