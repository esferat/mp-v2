import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { createLogger } from '@mp/service-kit';
import { loadSchedulingEnv } from '../shared/config';

/**
 * Точка входа сервиса scheduling. Порядок: валидация окружения (fail-fast) →
 * сборка приложения → trace-id middleware → глобальные filter/interceptor → listen.
 * Логирование — только pino (JSON в stdout → Filebeat → Kibana, 0.10).
 */
async function bootstrap(): Promise<void> {
  let log = createLogger({ name: 'scheduling' });

  try {
    const env = loadSchedulingEnv();
    log = createLogger({ name: 'scheduling', level: env.LOG_LEVEL });

    const { AppModule } = await import('./app.module');
    const app = await NestFactory.create(AppModule, { logger: false });
    app.enableShutdownHooks();

    await app.listen(env.PORT);
    log.info({ port: env.PORT }, 'scheduling запущен');
  } catch (error) {
    log.fatal({ err: error }, 'не удалось запустить scheduling');
    // Без process.exit(): асинхронный вывод pino успевает долиться
    // (event loop пуст → процесс завершится сам с кодом 1)
    process.exitCode = 1;
  }
}

void bootstrap();
