import { Injectable } from '@nestjs/common';
import { createPrismaOutboxStore, type OutboxStore } from '@mp/service-kit';
import type { PatientContext } from '../../entities/patient';
import type { UnitOfWork } from '../../entities/repository';
import type { OutboxWriter } from '../model';
import { PrismaService } from './prisma.service';
import { PrismaPatientRepository } from './prisma.patient-repository';

/**
 * Prisma-реализация Unit of Work: изменение карточки и событие patient.*
 * пишутся в одной транзакции (0.9: откат = нет события, crash после commit
 * = релеи доставит).
 */
@Injectable()
export class PrismaUnitOfWork implements UnitOfWork<PatientContext> {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(fn: (ctx: PatientContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) =>
      fn({
        patients: new PrismaPatientRepository(tx),
        outbox: toWriter(createPrismaOutboxStore(tx.outboxMessage)),
      }),
    );
  }
}

/** Адаптер store service-kit под порт OutboxWriter (методы совпадают по сигнатуре). */
function toWriter(store: OutboxStore): OutboxWriter {
  return { enqueue: (routingKey, payload) => store.enqueue(routingKey, payload) };
}
