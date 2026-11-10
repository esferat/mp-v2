import {
  CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs';
import type { Logger } from '@mp/service-kit';
import { LOGGER } from '@mp/service-kit';

/** Профиль HTTP-запроса без зависимости от типов express. */
interface RequestLike {
  method?: string;
  url?: string;
}

interface ResponseLike {
  statusCode?: number;
}

/**
 * Структурированный лог каждого запроса (0.10): method/path/status/duration + traceId
 * (подхватывается из AsyncLocalStorage пино-миксином) — цепочка запроса ищется в Kibana.
 */
@Injectable()
export class RequestLogInterceptor implements NestInterceptor {
  constructor(@Inject(LOGGER) private readonly log: Logger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestLike>();
    const response = context.switchToHttp().getResponse<ResponseLike>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.log.info(
            {
              method: request.method,
              path: request.url,
              status: response.statusCode,
              durationMs: Date.now() - startedAt,
            },
            'запрос обработан',
          );
        },
        error: (error: unknown) => {
          // Статус и тело логирует ApiErrorFilter — здесь только факт сбоя.
          this.log.error(
            {
              method: request.method,
              path: request.url,
              durationMs: Date.now() - startedAt,
              err: error,
            },
            'запрос завершился ошибкой',
          );
        },
      }),
    );
  }
}
