import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { createLogger } from '@mp/service-kit';
import { loadReportEnv } from '../shared/config';

/**
 * Точка входа сервиса report. Порядок: валидация окружения (fail-fast) →
 * сборка приложения → trace-id middleware → глобальные filter/interceptor → listen.
 * Логирование — только pino (JSON в stdout → Filebeat → Kibana, 0.10).
 */
async function bootstrap(): Promise<void> {
  let log = createLogger({ name: 'report' });

  try {
    const env = loadReportEnv();
    log = createLogger({ name: 'report', level: env.LOG_LEVEL });

    const { AppModule } = await import('./app.module');
    const app = await NestFactory.create(AppModule, { logger: false });
    app.enableShutdownHooks();

    await app.listen(env.PORT);
    log.info({ port: env.PORT }, 'report запущен');
  } catch (error) {
    log.fatal({ err: error }, 'не удалось запустить report');
    process.exit(1);
  }
}

void bootstrap();
