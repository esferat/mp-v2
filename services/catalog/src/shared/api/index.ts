import { type DynamicModule, Global, Module } from '@nestjs/common';
import { UNIT_OF_WORK } from '../../entities/repository';
import { SPECIALIZATION_REPOSITORY } from '../../entities/specialization';
import { DOCTOR_REPOSITORY, PHOTO_URL_SIGNER } from '../../entities/doctor';
import { PrismaService } from './prisma.service';
import { PrismaSpecializationRepository } from './specialization.prisma-repository';
import { PrismaDoctorRepository } from './prisma.doctor-repository';
import { PhotoUrlSignerAdapter } from './photo-signer';
import { PrismaUnitOfWork } from './prisma.unit-of-work';

/**
 * Адаптеры доступа к данным (fsd.md §4.4): Prisma-реализации портов entities.
 * Глобальный: привязки «порт → адаптер» доступны всем слайсам без повторных импортов;
 * подключается один раз из app/app.module.ts (composition root).
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class SharedApiModule {
  static forRoot(): DynamicModule {
    return {
      module: SharedApiModule,
      providers: [
        {
          provide: SPECIALIZATION_REPOSITORY,
          useFactory: (prisma: PrismaService) => new PrismaSpecializationRepository(prisma),
          inject: [PrismaService],
        },
        {
          provide: DOCTOR_REPOSITORY,
          useFactory: (prisma: PrismaService) => new PrismaDoctorRepository(prisma),
          inject: [PrismaService],
        },
        { provide: PHOTO_URL_SIGNER, useClass: PhotoUrlSignerAdapter },
        { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork },
      ],
      exports: [
        PrismaService,
        SPECIALIZATION_REPOSITORY,
        DOCTOR_REPOSITORY,
        PHOTO_URL_SIGNER,
        UNIT_OF_WORK,
      ],
    };
  }
}

export { PrismaService } from './prisma.service';
export { PrismaSpecializationRepository } from './specialization.prisma-repository';
export { PrismaDoctorRepository } from './prisma.doctor-repository';
export { PhotoUrlSignerAdapter } from './photo-signer';
export { PrismaUnitOfWork } from './prisma.unit-of-work';
