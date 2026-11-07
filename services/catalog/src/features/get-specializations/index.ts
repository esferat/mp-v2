import { Module } from '@nestjs/common';
import { GetSpecializationsController } from './api/get-specializations.controller';

/** Публичный API слайса (fsd.md §5): единственный вход для вышестоящих слоёв. */
@Module({
  controllers: [GetSpecializationsController],
})
export class GetSpecializationsModule {}

export { getSpecializations } from './app/get-specializations';
