import {
  ArgumentsHost,
  Catch,
  HttpException,
  Inject,
  Injectable,
  type ExceptionFilter,
} from '@nestjs/common';
import { getTraceId, LOGGER, type Logger } from '@mp/service-kit';
import { DomainError, ValidationError } from '../../shared/model';

/** Профиль HTTP-ответа без зависимости от типов express. */
interface HttpResponseLike {
  status(code: number): HttpResponseLike;
  json(body: unknown): unknown;
}

interface HttpRequestLike {
  url?: string;
  method?: string;
}

/**
 * Единый формат ошибок API (0.6: ApiError из @mp/contracts):
 * `{ code, message, requestId }`. Скрытые детали 500-ошибок не утекают наружу,
 * но полностью логируются с traceId (цепочка в Kibana, 0.10).
 */
@Catch()
@Injectable()
export class ApiErrorFilter implements ExceptionFilter {
  constructor(@Inject(LOGGER) private readonly log: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponseLike>();
    const request = host.switchToHttp().getRequest<HttpRequestLike>();
    const { status, code, message, field } = classify(exception);
    const requestId = getTraceId();

    // field: ошибка валидации привязана к полю формы (4.2 AC)
    const payload = {
      code,
      message,
      ...(field ? { field } : {}),
      ...(requestId ? { requestId } : {}),
    };

    if (status >= 500) {
      this.log.error(
        { err: exception, status, code, path: request.url, method: request.method },
        message,
      );
    } else {
      this.log.warn(
        { status, code, path: request.url, method: request.method },
        `${code}: ${message}`,
      );
    }

    response.status(status).json(payload);
  }
}

interface Classified {
  status: number;
  code: string;
  message: string;
  field?: string;
}

function classify(exception: unknown): Classified {
  if (exception instanceof DomainError) {
    const field = exception instanceof ValidationError ? exception.field : undefined;
    return {
      status: exception.status,
      code: exception.code,
      message: exception.message,
      ...(field ? { field } : {}),
    };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const body = exception.getResponse();
    const message =
      typeof body === 'string'
        ? body
        : typeof body === 'object' && body !== null && 'message' in body
          ? String((body as { message: unknown }).message)
          : exception.message;
    const code =
      typeof body === 'object' && body !== null && 'code' in body
        ? String((body as { code: unknown }).code)
        : `HTTP_${status}`;
    return { status, code, message };
  }

  // Внутренняя ошибка: детали — только в лог, клиенту — обобщённое сообщение.
  return { status: 500, code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера' };
}
