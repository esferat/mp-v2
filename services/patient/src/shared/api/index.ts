import { type DynamicModule, Global, Module } from '@nestjs/common';
import { PATIENT_REPOSITORY, PHOTO_URL_SIGNER } from '../../entities/patient';
import { UNIT_OF_WORK } from '../../entities/repository';
import { PrismaService } from './prisma.service';
import { PrismaPatientRepository } from './prisma.patient-repository';
import { PrismaUnitOfWork } from './prisma.unit-of-work';
import { PatientPhotoUrlSigner } from './photo-signer';

/**
 * Адаптеры доступа к данным (fsd.md §4.4): Prisma-реализации портов entities.
 * Глобальный: привязки «порт → адаптер» доступны всем слайсам без повторных
 * импортов; подключается один раз из app/app.module.ts (composition root).
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
          provide: PATIENT_REPOSITORY,
          useFactory: (prisma: PrismaService) => new PrismaPatientRepository(prisma),
          inject: [PrismaService],
        },
        { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork },
        { provide: PHOTO_URL_SIGNER, useClass: PatientPhotoUrlSigner },
      ],
      exports: [PrismaService, PATIENT_REPOSITORY, UNIT_OF_WORK, PHOTO_URL_SIGNER],
    };
  }
}

export { PrismaService } from './prisma.service';
export { PrismaPatientRepository } from './prisma.patient-repository';
export { PrismaUnitOfWork } from './prisma.unit-of-work';
export { PatientPhotoUrlSigner } from './photo-signer';
