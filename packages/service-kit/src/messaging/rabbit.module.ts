import { Global, Module, type DynamicModule } from '@nestjs/common';
import { RABBIT_CONFIG, RabbitService } from './rabbit.service';
import type { RabbitConfig } from './rabbit.types';

/**
 * Глобальный модуль RabbitMQ (0.9). Подключается один раз в app-модуле:
 *
 *   RabbitModule.forRoot({ url, exchange, dlxExchange, prefetch })
 *
 * Требует LoggerModule.forRoot (инъекция LOGGER).
 */
@Global()
@Module({
  providers: [RabbitService],
  exports: [RabbitService],
})
export class RabbitModule {
  static forRoot(config: RabbitConfig): DynamicModule {
    return {
      module: RabbitModule,
      providers: [{ provide: RABBIT_CONFIG, useValue: config }],
      exports: [RABBIT_CONFIG, RabbitService],
    };
  }
}
