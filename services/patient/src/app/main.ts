import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { createLogger } from '@mp/service-kit';
import { loadPatientEnv } from '../shared/config';

/**
 * Точка входа сервиса patient. Порядок: валидация окружения (fail-fast) →
 * сборка приложения → trace-id middleware → глобальные filter/interceptor → listen.
 * Логирование — только pino (JSON в stdout → Filebeat → Kibana, 0.10).
 */
async function bootstrap(): Promise<void> {
  let log = createLogger({ name: 'patient' });

  try {
    const env = loadPatientEnv();
    log = createLogger({ name: 'patient', level: env.LOG_LEVEL });

    const { AppModule } = await import('./app.module');
    const app = await NestFactory.create(AppModule, { logger: false });
    app.enableShutdownHooks();

    await app.listen(env.PORT);
    log.info({ port: env.PORT }, 'patient запущен');
  } catch (error) {
    log.fatal({ err: error }, 'не удалось запустить patient');
    process.exit(1);
  }
}

void bootstrap();
