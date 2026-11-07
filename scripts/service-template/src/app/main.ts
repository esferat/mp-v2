import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
{{MAIN_IMPORTS}}import { load{{CAP}}Env } from '../shared/config';

/**
 * Точка входа сервиса {{NAME}}. Порядок: валидация окружения (fail-fast) →
 * сборка приложения → listen. trace-id middleware, фильтр ошибок и логгер
 * запросов подключаются в AppModule (там же они живут в тестах, 0.7/1.2).
 * Логирование — только pino (JSON в stdout → Filebeat → Kibana, 0.10).
 */
async function bootstrap(): Promise<void> {
  let log = createLogger({ name: '{{NAME}}' });

  try {
    const env = load{{CAP}}Env();
    log = createLogger({ name: '{{NAME}}', level: env.LOG_LEVEL });

    const { AppModule } = await import('./app.module');
    const app = await NestFactory.create(AppModule, { logger: false });

    app.enableShutdownHooks();

    await app.listen(env.PORT);
    log.info({ port: env.PORT }, '{{NAME}} запущен');
  } catch (error) {
    log.fatal({ err: error }, 'не удалось запустить {{NAME}}');
    process.exit(1);
  }
}

void bootstrap();
