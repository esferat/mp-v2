import { Global, Inject, Module, type DynamicModule } from '@nestjs/common';
import type { LogLevel } from '../config/env';
import { createLogger } from './logger';

/** Токен для инъекции pino-логгера: `constructor(@Inject(LOGGER) private log: Logger)`. */
export const LOGGER = Symbol('MP_LOGGER');

export interface LoggerModuleOptions {
  name: string;
  level?: LogLevel;
}

/**
 * Глобальный модуль логирования: подключается один раз в app-модуле сервиса,
 * после чего LOGGER доступен везде (включая service-kit-модули health/outbox).
 */
@Global()
@Module({})
export class LoggerModule {
  static forRoot(options: LoggerModuleOptions): DynamicModule {
    return {
      module: LoggerModule,
      providers: [
        {
          provide: LOGGER,
          useValue: createLogger({ name: options.name, level: options.level }),
        },
      ],
      exports: [LOGGER],
    };
  }
}

/** Удобная обёртка для инъекции без ручного Inject(LOGGER). */
export function InjectLogger(): ParameterDecorator {
  return Inject(LOGGER);
}
