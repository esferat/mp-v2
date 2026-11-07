import { Injectable } from '@nestjs/common';
import { createPrismaOutboxStore, type OutboxStore } from '@mp/service-kit';
import type { DoctorContext } from '../../entities/doctor';
import type { SpecializationContext } from '../../entities/specialization';
import type { UnitOfWork } from '../../entities/repository';
import type { OutboxWriter } from '../model';
import { PrismaService } from './prisma.service';
import { PrismaDoctorRepository } from './prisma.doctor-repository';
import { PrismaSpecializationRepository } from './specialization.prisma-repository';

/**
 * Prisma-реализация Unit of Work: бизнес-запись и запись в outbox выполняются
 * в одной транзакции (0.9: откат транзакции = нет события, crash после commit
 * = релеи доставит). Контекст — пересечение контекстов слайсов
 * (справочник и врачи): каждый use-case читает из него только своё.
 */
@Injectable()
export class PrismaUnitOfWork implements UnitOfWork<SpecializationContext & DoctorContext> {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(fn: (ctx: SpecializationContext & DoctorContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) =>
      fn({
        specializations: new PrismaSpecializationRepository(tx),
        doctors: new PrismaDoctorRepository(tx),
        outbox: toWriter(createPrismaOutboxStore(tx.outboxMessage)),
      }),
    );
  }
}

/** Адаптер store service-kit под порт OutboxWriter (методы совпадают по сигнатуре). */
function toWriter(store: OutboxStore): OutboxWriter {
  return { enqueue: (routingKey, payload) => store.enqueue(routingKey, payload) };
}
