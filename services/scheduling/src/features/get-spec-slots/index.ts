import { Module } from '@nestjs/common';
import { GetSpecSlotsController } from './api/get-spec-slots.controller';

/** Публичный API слайса (fsd.md S5): свободные слоты по специализации (5.2). */
@Module({
  controllers: [GetSpecSlotsController],
})
export class GetSpecSlotsModule {}

export { getSpecSlots } from './app/get-spec-slots';
export type { GetSpecSlotsDeps } from './app/get-spec-slots';
