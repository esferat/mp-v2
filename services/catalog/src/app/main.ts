import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { createLogger } from '@mp/service-kit';
import { loadCatalogEnv } from '../shared/config';

/**
 * Точка входа сервиса каталога. Порядок: валидация окружения (fail-fast) →
 * сборка приложения → trace-id middleware → глобальные filter/interceptor → listen.
 * Логирование — только pino (JSON в stdout → Filebeat → Kibana, 0.10).
 */
async function bootstrap(): Promise<void> {
  let log = createLogger({ name: 'catalog' });

  try {
    const env = loadCatalogEnv();
    log = createLogger({ name: 'catalog', level: env.LOG_LEVEL });

    const { AppModule } = await import('./app.module');
    const app = await NestFactory.create(AppModule, { logger: false });
    app.enableShutdownHooks();

    await app.listen(env.PORT);
    log.info({ port: env.PORT }, 'catalog запущен');
  } catch (error) {
    log.fatal({ err: error }, 'не удалось запустить catalog');
    process.exit(1);
  }
}

// Для консистентности с другими сервисами: тот же middleware доступен и через configure().
void bootstrap();
