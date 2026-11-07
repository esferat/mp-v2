import { Module } from '@nestjs/common';
import { ProxyController } from './proxy.controller';
import { FETCH, ProxyService } from './proxy.service';

/**
 * Публичный API слайса (fsd.md §5): маршрутизация `/api/<service>/**`
 * на внутренние адреса сервисов.
 */
@Module({
  controllers: [ProxyController],
  providers: [ProxyService, { provide: FETCH, useValue: fetch }],
  exports: [ProxyService],
})
export class ProxyModule {}

export { FETCH, ProxyService } from './proxy.service';
export type { FetchBody, FetchLike, ProxyRequestLike, UpstreamResponse } from './proxy.service';
