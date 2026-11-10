import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ClientCredentialsTokenCache } from '@mp/service-kit';
import { ACCESS_PORTS } from '../../entities/access';
import { FILE_REPOSITORY, LINK_SIGNER, OBJECT_STORE, PHOTO_LINKER } from '../../entities/file';
import { UNIT_OF_WORK } from '../../entities/repository';
import { getFileEnv } from '../config';
import { PrismaService } from './prisma.service';
import { PrismaFileRepository } from './prisma.file-repository';
import { PrismaUnitOfWork } from './prisma.unit-of-work';
import { S3ObjectStore } from './s3-store';
import { S3FileLinkSigner } from './file-signer';
import { PATIENT_CLIENT, PatientHttpClient } from './patient.http.client';
import { CATALOG_CLIENT, CatalogHttpClient } from './catalog.http.client';
import { SCHEDULING_CLIENT, SchedulingHttpClient } from './scheduling.http.client';
import { AccessPortsComposite } from './access-ports.composite';
import { PhotoLinkerAdapter } from './photo-linker.adapter';

/** Внутренний токен: кэш кредов svc-file (только сборка модуля). */
const SERVICE_TOKENS = Symbol('FileServiceTokenCache');

/**
 * Адаптеры доступа к данным (fsd.md §4.4): Prisma-реализации портов entities,
 * объектное хранилище, HTTP-клиенты соседей и привязка фото. Привязки
 * «порт → адаптер» собираются здесь, модуль подключается из app/app.module.ts.
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
          provide: FILE_REPOSITORY,
          useFactory: (prisma: PrismaService) => new PrismaFileRepository(prisma),
          inject: [PrismaService],
        },
        { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork },
        { provide: OBJECT_STORE, useClass: S3ObjectStore },
        { provide: LINK_SIGNER, useClass: S3FileLinkSigner },
        {
          // Кэш кредов svc-file (client credentials для вызовов соседей)
          provide: SERVICE_TOKENS,
          useFactory: () => {
            const env = getFileEnv();
            return new ClientCredentialsTokenCache({
              keycloakInternalUrl: env.KEYCLOAK_INTERNAL_URL,
              realm: env.KEYCLOAK_REALM,
              clientId: env.KEYCLOAK_SVC_FILE_CLIENT_ID,
              clientSecret: env.KEYCLOAK_SVC_FILE_SECRET,
            });
          },
        },
        {
          provide: PATIENT_CLIENT,
          useFactory: (tokens: ClientCredentialsTokenCache) =>
            new PatientHttpClient(getFileEnv(), tokens),
          inject: [SERVICE_TOKENS],
        },
        {
          provide: CATALOG_CLIENT,
          useFactory: (tokens: ClientCredentialsTokenCache) =>
            new CatalogHttpClient(getFileEnv(), tokens),
          inject: [SERVICE_TOKENS],
        },
        {
          provide: SCHEDULING_CLIENT,
          useFactory: (tokens: ClientCredentialsTokenCache) =>
            new SchedulingHttpClient(getFileEnv(), tokens),
          inject: [SERVICE_TOKENS],
        },
        // Порт прав (entities/access) — композит patient- и scheduling-клиентов (9.3)
        {
          provide: ACCESS_PORTS,
          useFactory: (patient: PatientHttpClient, scheduling: SchedulingHttpClient) =>
            new AccessPortsComposite(patient, scheduling),
          inject: [PATIENT_CLIENT, SCHEDULING_CLIENT],
        },
        {
          provide: PHOTO_LINKER,
          useFactory: (patient: PatientHttpClient, catalog: CatalogHttpClient) =>
            new PhotoLinkerAdapter(patient, catalog),
          inject: [PATIENT_CLIENT, CATALOG_CLIENT],
        },
      ],
      exports: [
        PrismaService,
        FILE_REPOSITORY,
        UNIT_OF_WORK,
        OBJECT_STORE,
        LINK_SIGNER,
        ACCESS_PORTS,
        PHOTO_LINKER,
        PATIENT_CLIENT,
        CATALOG_CLIENT,
        SCHEDULING_CLIENT,
      ],
    };
  }
}

export { PrismaService } from './prisma.service';
export { PATIENT_CLIENT, CATALOG_CLIENT, SCHEDULING_CLIENT };
