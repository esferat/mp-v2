import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import type { Logger } from '@mp/service-kit';
import { HealthRegistry, LOGGER, RabbitService } from '@mp/service-kit';
import { PrismaService } from '../../shared/api';

/**
 * Регистрация health-проверок (наблюдаемость /readyz, 0.7): /readyz отдаёт 503,
 * если хотя бы одна проверка падает (rabbit/postgres). Liveness (/healthz) — 200
 * всегда: процесс жив, даже если брокер/БД недоступны.
 */
@Injectable()
export class RegisterHealthChecks implements OnApplicationBootstrap {
  constructor(
    private readonly registry: HealthRegistry,
    private readonly prisma: PrismaService,
    private readonly rabbit: RabbitService,
    @Inject(LOGGER) private readonly log: Logger,
  ) {}

  onApplicationBootstrap(): void {
    this.registry.register({
      name: 'postgres',
      check: async () => {
        await this.prisma.$queryRaw`SELECT 1`;
      },
    });

    this.registry.register({
      name: 'rabbitmq',
      check: async () => {
        if (!this.rabbit.isReady()) {
          throw new Error('нет соединения с RabbitMQ');
        }
      },
    });

    this.log.debug('health-проверки подключены (postgres, rabbitmq)');
  }
}
