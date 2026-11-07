import { Injectable } from '@nestjs/common';
import { createPrismaOutboxStore, type OutboxStore } from '@mp/service-kit';
import type { FileContext } from '../../entities/file';
import type { UnitOfWork } from '../../entities/repository';
import type { OutboxWriter } from '../model';
import { PrismaService } from './prisma.service';
import { PrismaFileRepository } from './prisma.file-repository';

/**
 * Prisma-реализация Unit of Work: строка реестра и событие document.* пишутся
 * в одной транзакции (0.9: откат = нет события, crash после commit = релеи
 * доставит). Объект в MinIO живёт вне транзакции: стратегии upload/delete
 * описаны в их use-case (компенсация best-effort).
 */
@Injectable()
export class PrismaUnitOfWork implements UnitOfWork<FileContext> {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(fn: (ctx: FileContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) =>
      fn({
        files: new PrismaFileRepository(tx),
        outbox: toWriter(createPrismaOutboxStore(tx.outboxMessage)),
      }),
    );
  }
}

/** Адаптер store service-kit под порт OutboxWriter (методы совпадают по сигнатуре). */
function toWriter(store: OutboxStore): OutboxWriter {
  return { enqueue: (routingKey, payload) => store.enqueue(routingKey, payload) };
}
