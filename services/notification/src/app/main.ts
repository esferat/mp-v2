import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { createLogger } from '@mp/service-kit';
import { loadNotificationEnv } from '../shared/config';

/**
 * Точка входа сервиса notification. Порядок: валидация окружения (fail-fast) →
 * сборка приложения → trace-id middleware → глобальные filter/interceptor → listen.
 * Логирование — только pino (JSON в stdout → Filebeat → Kibana, 0.10).
 */
async function bootstrap(): Promise<void> {
  let log = createLogger({ name: 'notification' });

  try {
    const env = loadNotificationEnv();
    log = createLogger({ name: 'notification', level: env.LOG_LEVEL });

    const { AppModule } = await import('./app.module');
    const app = await NestFactory.create(AppModule, { logger: false });
    app.enableShutdownHooks();

    await app.listen(env.PORT);
    log.info({ port: env.PORT }, 'notification запущен');
  } catch (error) {
    log.fatal({ err: error }, 'не удалось запустить notification');
    process.exit(1);
  }
}

void bootstrap();
