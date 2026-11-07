import { Global, Module, type DynamicModule } from '@nestjs/common';
import { PATIENT_REPOSITORY } from '../../entities/patient';
import { PrismaService } from './prisma.service';
import { PrismaPatientRepository } from './prisma.patient-repository';

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
      ],
      exports: [PrismaService, PATIENT_REPOSITORY],
    };
  }
}

export { PrismaService } from './prisma.service';
export { PrismaPatientRepository } from './prisma.patient-repository';
