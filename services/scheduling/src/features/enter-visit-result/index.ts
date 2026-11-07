import { Module } from '@nestjs/common';
import { EnterVisitResultController } from './api/enter-visit-result.controller';

/** Публичный API слайса (fsd.md S5): результат приёма (9.2). */
@Module({
  controllers: [EnterVisitResultController],
})
export class EnterVisitResultModule {}

export { enterVisitResult } from './app/enter-visit-result';
export type { EnterVisitResultDeps } from './app/enter-visit-result';
