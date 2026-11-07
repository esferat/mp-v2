import pino, { type DestinationStream, type Logger, type LoggerOptions } from 'pino';
import type { LogLevel } from '../config/env';
import { getTraceId } from './context';

export type { Logger };

export interface CreateLoggerOptions {
  /** Имя сервиса — попадает в поле service каждой записи. */
  name: string;
  level?: LogLevel;
  /** Куда писать (по умолчанию stdout). В тестах — память. */
  destination?: DestinationStream;
}

/**
 * Фабрика JSON-логгера (0.10): stdout → Filebeat → Elasticsearch → Kibana.
 * В каждую запись внутри запросного контекста добавляется traceId (миксин),
 * timestamp — ISO-8601 (удобно для разбора в Kibana).
 */
export function createLogger({ name, level = 'info', destination }: CreateLoggerOptions): Logger {
  const options: LoggerOptions = {
    level,
    base: { service: name },
    timestamp: pino.stdTimeFunctions.isoTime,
    mixin(): Record<string, unknown> {
      const traceId = getTraceId();
      return traceId ? { traceId } : {};
    },
  };
  return destination ? pino(options, destination) : pino(options);
}
