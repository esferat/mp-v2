import { type DynamicModule, Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Адаптеры доступа к данным (fsd.md §4.4): Prisma-реализации портов entities.
 * Привязки «порт → адаптер» добавляются здесь по мере появления домена;
 * модуль подключается из app/app.module.ts (composition root).
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class SharedApiModule {
  /**
   * Точка расширения: сюда добавляются привязки «порт → адаптер»
   * по мере появления домена (как в эталоне services/catalog).
   */
  static forRoot(): DynamicModule {
    return {
      module: SharedApiModule,
      providers: [],
      exports: [PrismaService],
    };
  }
}

export { PrismaService } from './prisma.service';
