import { Controller, Get, Module, ServiceUnavailableException } from '@nestjs/common';
import { HealthRegistry } from './health.registry';

export interface LivenessResponse {
  status: 'ok';
  uptimeSeconds: number;
}

export interface ReadinessResponse {
  status: 'ready' | 'not-ready';
  checks: Awaited<ReturnType<HealthRegistry['runAll']>>;
}

@Controller()
class HealthController {
  /** Liveness: процесс жив — 200 независимо от зависимостей. */
  @Get('healthz')
  healthz(): LivenessResponse {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }

  /** Readiness: все зарегистрированные проверки прошли, иначе 503 (0.7). */
  @Get('readyz')
  async readyz(): Promise<ReadinessResponse> {
    const checks = await this.registry.runAll();
    const failed = checks.filter((check) => check.status === 'fail');

    if (failed.length > 0) {
      throw new ServiceUnavailableException({
        status: 'not-ready',
        checks,
      });
    }
    return { status: 'ready', checks };
  }

  constructor(private readonly registry: HealthRegistry) {}
}

/**
 * Модуль health-эндпоинтов: подключается в app-модуле сервиса,
 * сервис регистрирует свои проверки через HealthRegistry.
 */
@Module({
  controllers: [HealthController],
  providers: [HealthRegistry],
  exports: [HealthRegistry],
})
export class HealthModule {}
