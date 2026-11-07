import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { createLogger } from '@mp/service-kit';
import { loadFileEnv } from '../shared/config';

/**
 * Точка входа сервиса file. Порядок: валидация окружения (fail-fast) →
 * сборка приложения → trace-id middleware → глобальные filter/interceptor → listen.
 * Логирование — только pino (JSON в stdout → Filebeat → Kibana, 0.10).
 */
async function bootstrap(): Promise<void> {
  let log = createLogger({ name: 'file' });

  try {
    const env = loadFileEnv();
    log = createLogger({ name: 'file', level: env.LOG_LEVEL });

    const { AppModule } = await import('./app.module');
    const app = await NestFactory.create(AppModule, { logger: false });
    app.enableShutdownHooks();

    await app.listen(env.PORT);
    log.info({ port: env.PORT }, 'file запущен');
  } catch (error) {
    log.fatal({ err: error }, 'не удалось запустить file');
    process.exit(1);
  }
}

void bootstrap();
