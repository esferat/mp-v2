import { Module } from '@nestjs/common';
import { VisitResultController } from './api/visit-result.controller';

/**
 * Публичный API слайса (fsd.md §5): просмотр и правка результата
 * приёма (9.2 get-visit-result / update-visit-result).
 */
@Module({
  controllers: [VisitResultController],
})
export class VisitResultModule {}

export { getVisitResult } from './app/get-visit-result';
export { updateVisitResult } from './app/update-visit-result';
export { requireOwningDoctor } from './app/require-owning-doctor';
