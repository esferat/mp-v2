// Конфигурация окружения
export { baseEnvSchema, loadEnv, logLevels } from './config/env';
export type { BaseEnv, LogLevel } from './config/env';

// Аутентификация (1.2: защита в глубину в каждом сервисе)
export {
  AuthModule,
  AUTH_OPTIONS,
  JwtAuthGuard,
  isPublicPath,
  TOKEN_VERIFIER,
} from './auth/auth.module';
export type { AuthModuleOptions, RequestAuth, AccessSubject } from './auth/auth.module';
export { JwksTokenVerifier, TokenInvalidError, matchesAudience } from './auth/jwks-verifier';
export type { JwksVerifierOptions, VerifiedToken } from './auth/jwks-verifier';
export { ClientCredentialsTokenCache } from './auth/client-credentials';
export type { ServiceAccountCredentials } from './auth/client-credentials';

// Логирование и трассировка
export { createLogger } from './logger/logger';
export type { CreateLoggerOptions, Logger } from './logger/logger';
export { getTraceId, newTraceId, runWithTraceId } from './logger/context';
export type { TraceContext } from './logger/context';
export { LOGGER, InjectLogger, LoggerModule } from './logger/logger.module';
export type { LoggerModuleOptions } from './logger/logger.module';
export {
  TRACE_HEADER,
  traceIdMiddleware,
  applyTraceIdMiddleware,
} from './tracing/trace-id.middleware';
export type { TraceIdMiddlewareFn } from './tracing/trace-id.middleware';

// Health + метрики (наблюдаемость: /healthz, /readyz, /metrics — 0.7/0.9)
export { HealthRegistry } from './health/health.registry';
export type { HealthCheck, HealthCheckResult } from './health/health.registry';
export { HealthModule } from './health/health.module';
export type { LivenessResponse, ReadinessResponse } from './health/health.module';
export {
  MetricsModule,
  consumerErrorsTotal,
  dlqDepth,
  incConsumerErrors,
  incOutboxFailed,
  outboxFailedTotal,
  outboxLagSeconds,
  queueDepth,
  renderMetrics,
  setOutboxLagSeconds,
  setQueueDepths,
} from './metrics/metrics.module';

// Сообщения: RabbitMQ + outbox/inbox
export { RABBIT_CONFIG, RabbitService } from './messaging/rabbit.service';
export { RabbitModule } from './messaging/rabbit.module';
export {
  PermanentConsumerError,
  RabbitUnavailableError,
  TransientConsumerError,
} from './messaging/rabbit.types';
export { createEvent, createEventMeta } from './messaging/event';
export type { EventMeta } from './messaging/event';
export type {
  ConsumedEvent,
  EventHandler,
  QueueSubscription,
  RabbitConfig,
} from './messaging/rabbit.types';
export { createConsumerHandler } from './messaging/consumer';
export type { ConsumerOptions } from './messaging/consumer';
export {
  OUTBOX_OPTIONS,
  OUTBOX_STORE,
  OutboxModule,
  OutboxRelay,
  OutboxService,
  createPrismaOutboxStore,
  defaultOutboxOptions,
  retryDelayMs,
} from './messaging/outbox';
export type {
  OutboxModuleAsyncOptions,
  OutboxModuleOptions,
  OutboxOptions,
  OutboxRecord,
  OutboxStatus,
  OutboxStore,
  PrismaOutboxDelegate,
} from './messaging/outbox';
export { INBOX_STORE, InboxModule, InboxService, createPrismaInboxStore } from './messaging/inbox';
export type { InboxModuleOptions, InboxStore, PrismaInboxDelegate } from './messaging/inbox';
