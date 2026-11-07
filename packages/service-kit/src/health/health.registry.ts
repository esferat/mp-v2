import { Injectable } from '@nestjs/common';

/** Проверка готовности: бросает исключение, если компонент недоступен. */
export interface HealthCheck {
  name: string;
  check(): Promise<void>;
}

export interface HealthCheckResult {
  name: string;
  status: 'ok' | 'fail';
  durationMs: number;
  error?: string;
}

/**
 * Реестр проверок готовности (0.7): сервис регистрирует проверки (БД, брокер),
 * /readyz выполняет все и отдаёт 503 при любой ошибке. /healthz — только живость процесса.
 */
@Injectable()
export class HealthRegistry {
  private readonly checks: HealthCheck[] = [];

  register(check: HealthCheck): void {
    this.checks.push(check);
  }

  async runAll(): Promise<HealthCheckResult[]> {
    return Promise.all(
      this.checks.map(async (check): Promise<HealthCheckResult> => {
        const startedAt = Date.now();
        try {
          await check.check();
          return { name: check.name, status: 'ok', durationMs: Date.now() - startedAt };
        } catch (error) {
          return {
            name: check.name,
            status: 'fail',
            durationMs: Date.now() - startedAt,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );
  }
}
