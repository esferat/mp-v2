import { All, Controller, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { ProxyService } from './proxy.service';

/**
 * Адаптер входа (fsd.md §4.2): только проброс запроса к нужному сервису,
 * бизнес-логики нет — вся политика (JWT, роли, rate-limit) в глобальных
 * guard/interceptor. Публичный API gateway: `/api/<service>/**`.
 */
@Controller()
export class ProxyController {
  constructor(private readonly proxy: ProxyService) {}

  /** GET /api/<service> — без хвоста пути. */
  @All('api/:service')
  root(
    @Param('service') service: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    return this.dispatch(service, req, res);
  }

  /** /api/<service>/** — проксируется целиком (path-to-regexp v8: {*path}). */
  @All('api/:service/{*path}')
  any(@Param('service') service: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    return this.dispatch(service, req, res);
  }

  /**
   * Ответ сервиса возвращается как есть (без повторной сериализации Nest):
   * статус + заголовки upstream + тело СТРИМОМ (память ×1 вместо ×2,
   * TTFB не ждёт полного ответа — файлы/отчёты). Исключения (404/502/504)
   * перехватывает ApiErrorFilter — он управляет res сам.
   */
  private async dispatch(service: string, req: Request, res: Response): Promise<void> {
    const target = this.proxy.resolveUpstream(service, req.originalUrl);
    const upstream = await this.proxy.forward(req.method, target, {
      method: req.method,
      originalUrl: req.originalUrl,
      headers: req.headers,
      body: req.body,
      readable: req,
    });

    res.status(upstream.status);
    for (const [key, value] of Object.entries(upstream.headers)) {
      res.setHeader(key, value);
    }

    if (!upstream.body) {
      res.end();
      return;
    }

    const stream = Readable.fromWeb(upstream.body);
    // Клиент отключился — гасим стрим, не дожидаясь конца ответа upstream
    res.on('close', () => stream.destroy());
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  }
}
