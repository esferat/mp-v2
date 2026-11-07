import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { createLogger } from '@mp/service-kit';
import { loadIdentityEnv } from '../shared/config';

/**
 * Точка входа сервиса identity. Порядок: валидация окружения (fail-fast) →
 * сборка приложения → trace-id middleware → глобальные filter/interceptor → listen.
 * Логирование — только pino (JSON в stdout → Filebeat → Kibana, 0.10).
 */
async function bootstrap(): Promise<void> {
  let log = createLogger({ name: 'identity' });

  try {
    const env = loadIdentityEnv();
    log = createLogger({ name: 'identity', level: env.LOG_LEVEL });

    const { AppModule } = await import('./app.module');
    const app = await NestFactory.create(AppModule, { logger: false });
    app.enableShutdownHooks();

    await app.listen(env.PORT);
    log.info({ port: env.PORT }, 'identity запущен');
  } catch (error) {
    log.fatal({ err: error }, 'не удалось запустить identity');
    process.exit(1);
  }
}

void bootstrap();
