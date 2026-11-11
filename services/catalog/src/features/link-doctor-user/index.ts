import { Module } from '@nestjs/common';
import { LinkDoctorUserController } from './api/link-doctor-user.controller';

/** Слайс привязки учётной записи к карточке врача (fsd.md S5, правило «всегда»). */
@Module({
  controllers: [LinkDoctorUserController],
})
export class LinkDoctorUserModule {}

export { linkDoctorUser } from './app/link-doctor-user';
