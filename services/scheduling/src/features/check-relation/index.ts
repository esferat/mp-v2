import { Module } from '@nestjs/common';
import { CheckRelationController } from './api/check-relation.controller';

/**
 * Публичный API слайса (fsd.md §5): служебная проверка связи
 * «врач-пациент» и привязка sub → doctorId (9.3, для file-service).
 */
@Module({
  controllers: [CheckRelationController],
})
export class CheckRelationModule {}

export { checkDoctorRelation, getDoctorByUser } from './app/check-relation';
export type { CheckRelationDeps } from './app/check-relation';
