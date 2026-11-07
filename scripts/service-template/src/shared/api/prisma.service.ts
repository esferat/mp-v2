import { Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { get{{CAP}}Env } from '../config';

/**
 * Клиент БД сервиса (адаптер, fsd.md §4.4): один пул соединений на процесс,
 * URL — только из своей переменной (доступ к чужим БД исключён на уровне Prisma).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnApplicationShutdown {
  constructor() {
    const env = get{{CAP}}Env();
    super({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}
