import { type MiddlewareConsumer } from '@nestjs/common';
import { newTraceId, runWithTraceId } from '../logger/context';

/** Заголовок трассировки (architecture.md §6.1): приходит от nginx/клиента. */
export const TRACE_HEADER = 'x-request-id';

/** Минимальный профиль HTTP-запроса/ответа (без зависимости от типов express). */
interface HttpRequestLike {
  header(name: string): string | undefined;
}

interface HttpResponseLike {
  setHeader(name: string, value: string): void;
}

type NextFunctionLike = () => void;

export type TraceIdMiddlewareFn = (
  req: HttpRequestLike,
  res: HttpResponseLike,
  next: NextFunctionLike,
) => void;

/**
 * Прокидывает trace-id через весь запрос: берёт X-Request-ID из заголовка
 * (или генерирует новый), возвращает его в ответе и кладёт в AsyncLocalStorage —
 * оттуда его подхватывает пино-миксин (fsd.md §5, architecture.md §6.1).
 *
 * Используется как express- middleware: `app.use(traceIdMiddleware)`.
 */
export const traceIdMiddleware: TraceIdMiddlewareFn = (req, res, next) => {
  const incoming = req.header(TRACE_HEADER)?.trim();
  const traceId = incoming && incoming.length > 0 ? incoming : newTraceId();

  res.setHeader('X-Request-Id', traceId);
  runWithTraceId(traceId, next);
};

/** Альтернатива для Nest-модулей: consumer.apply(traceIdMiddleware).forRoutes('*'). */
export function applyTraceIdMiddleware(consumer: MiddlewareConsumer): void {
  consumer.apply(traceIdMiddleware).forRoutes('*');
}
