import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ClientCredentialsTokenCache } from '@mp/service-kit';
import { APPOINTMENT_REPOSITORY } from '../../entities/appointment';
import { UNIT_OF_WORK } from '../../entities/repository';
import { SCHEDULE_COPY_REPOSITORY } from '../../entities/schedule-copy';
import { VISIT_RESULT_REPOSITORY } from '../../entities/visit-result';
import { getSchedulingEnv } from '../config';
import { PrismaService } from './prisma.service';
import { PrismaAppointmentRepository } from './prisma.appointment-repository';
import { PrismaScheduleCopyRepository } from './prisma.schedule-copy-repository';
import { PrismaUnitOfWork } from './prisma.unit-of-work';
import { PrismaVisitResultRepository } from './prisma.visit-result-repository';
import { PATIENT_CLIENT, PatientHttpClient } from './patient.http.client';
import { CATALOG_CLIENT, CatalogHttpClient } from './catalog.http.client';

/** Внутренний токен: кэш кредов svc-backend (только сборка модуля). */
const SERVICE_TOKENS = Symbol('SchedulingServiceTokenCache');

/**
 * Адаптеры доступа к данным (fsd.md §4.4): Prisma-реализации портов entities
 * и HTTP-клиенты соседей. Сборка привязок — здесь, подключение — в app/app.module.ts.
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
          provide: SCHEDULE_COPY_REPOSITORY,
          useFactory: (prisma: PrismaService) => new PrismaScheduleCopyRepository(prisma),
          inject: [PrismaService],
        },
        {
          provide: APPOINTMENT_REPOSITORY,
          useFactory: (prisma: PrismaService) => new PrismaAppointmentRepository(prisma),
          inject: [PrismaService],
        },
        {
          provide: VISIT_RESULT_REPOSITORY,
          useFactory: (prisma: PrismaService) => new PrismaVisitResultRepository(prisma),
          inject: [PrismaService],
        },
        { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork },
        {
          provide: SERVICE_TOKENS,
          useFactory: () => {
            const env = getSchedulingEnv();
            return new ClientCredentialsTokenCache({
              keycloakInternalUrl: env.KEYCLOAK_INTERNAL_URL,
              realm: env.KEYCLOAK_REALM,
              clientId: env.KEYCLOAK_SVC_BACKEND_CLIENT_ID,
              clientSecret: env.KEYCLOAK_SVC_BACKEND_SECRET,
            });
          },
        },
        {
          provide: PATIENT_CLIENT,
          useFactory: (tokens: ClientCredentialsTokenCache) =>
            new PatientHttpClient(getSchedulingEnv(), tokens),
          inject: [SERVICE_TOKENS],
        },
        {
          provide: CATALOG_CLIENT,
          useFactory: (tokens: ClientCredentialsTokenCache) =>
            new CatalogHttpClient(getSchedulingEnv(), tokens),
          inject: [SERVICE_TOKENS],
        },
      ],
      exports: [
        PrismaService,
        SCHEDULE_COPY_REPOSITORY,
        APPOINTMENT_REPOSITORY,
        VISIT_RESULT_REPOSITORY,
        UNIT_OF_WORK,
        PATIENT_CLIENT,
        CATALOG_CLIENT,
      ],
    };
  }
}

export { PrismaService } from './prisma.service';
export { PATIENT_CLIENT, PatientHttpClient } from './patient.http.client';
export { CATALOG_CLIENT, CatalogHttpClient } from './catalog.http.client';
