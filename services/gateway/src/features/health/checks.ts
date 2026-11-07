import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import type { Logger } from '@mp/service-kit';
import { HealthRegistry, LOGGER } from '@mp/service-kit';

/**
 * Регистрация проверок готовности сервиса (0.7): /readyz отдаёт 503,
 * пока БД или брокер недоступны. Liveness (/healthz) от них не зависит.
 */
@Injectable()
export class RegisterHealthChecks implements OnApplicationBootstrap {
  constructor(
    private readonly registry: HealthRegistry,

    @Inject(LOGGER) private readonly log: Logger,
  ) {}

  onApplicationBootstrap(): void {
    // Зависимостей пока нет: /readyz отвечает 200, как только появятся (0.7)

    this.log.debug('health-проверки зарегистрированы');
  }
}
