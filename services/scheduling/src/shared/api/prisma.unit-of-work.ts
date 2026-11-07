import { Injectable } from '@nestjs/common';
import { createPrismaOutboxStore, type OutboxStore } from '@mp/service-kit';
import type { AppointmentContext } from '../../entities/appointment';
import type { VisitResultContext } from '../../entities/visit-result';
import type { UnitOfWork } from '../../entities/repository';
import type { OutboxWriter } from '../model';
import { PrismaService } from './prisma.service';
import { PrismaAppointmentRepository } from './prisma.appointment-repository';
import { PrismaVisitResultRepository } from './prisma.visit-result-repository';

/**
 * Prisma-реализация Unit of Work: запись брони/статуса, результат приёма
 * и событие appointment.* пишутся в одной транзакции (0.9: откат = нет
 * события, crash после commit = релеи доставит). Контекст — пересечение
 * AppointmentContext & VisitResultContext: каждый use-case читает из него
 * только своё (граница FSD между entities).
 */
@Injectable()
export class PrismaUnitOfWork implements UnitOfWork<AppointmentContext & VisitResultContext> {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(fn: (ctx: AppointmentContext & VisitResultContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) =>
      fn({
        appointments: new PrismaAppointmentRepository(tx),
        visitResults: new PrismaVisitResultRepository(tx),
        outbox: toWriter(createPrismaOutboxStore(tx.outboxMessage)),
      }),
    );
  }
}

/** Адаптер store service-kit под порт OutboxWriter (методы совпадают по сигнатуре). */
function toWriter(store: OutboxStore): OutboxWriter {
  return { enqueue: (routingKey, payload) => store.enqueue(routingKey, payload) };
}
