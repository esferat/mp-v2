import { Global, Module, type DynamicModule } from '@nestjs/common';
import type { Logger } from '@mp/service-kit';
import { LOGGER } from '@mp/service-kit';
import { PATIENT_CARDS, USER_DIRECTORY } from '../../entities/registration';
import { getIdentityEnv, type IdentityEnv } from '../config';
import { PrismaService } from './prisma.service';
import { KeycloakAdminClient } from './keycloak-admin.client';
import { PatientHttpCards } from './patient.http.client';
import { ClientCredentialsTokenCache } from './token-cache';

/** Общий кэш client-credentials токена (Admin API + service-to-service). */
export const TOKEN_CACHE = Symbol('IdentityTokenCache');

/**
 * Адаптеры доступа к данным и внешним системам (fsd.md §4.4):
 * Prisma-реализации портов entities + клиенты Keycloak/patient (сага 1.4).
 * Глобальный, подключается один раз из app/app.module.ts (composition root).
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
          provide: TOKEN_CACHE,
          useFactory: () => new ClientCredentialsTokenCache(getIdentityEnv()),
        },
        {
          provide: USER_DIRECTORY,
          useFactory: (log: Logger, tokens: ClientCredentialsTokenCache) =>
            new KeycloakAdminClient(getIdentityEnv(), log, tokens),
          inject: [LOGGER, TOKEN_CACHE],
        },
        {
          provide: PATIENT_CARDS,
          useFactory: (tokens: ClientCredentialsTokenCache) =>
            new PatientHttpCards(getIdentityEnv(), tokens),
          inject: [TOKEN_CACHE],
        },
      ],
      exports: [PrismaService, USER_DIRECTORY, PATIENT_CARDS, TOKEN_CACHE],
    };
  }
}

export { PrismaService } from './prisma.service';
export { KeycloakAdminClient } from './keycloak-admin.client';
export { PatientHttpCards } from './patient.http.client';
export { ClientCredentialsTokenCache } from './token-cache';
export type { IdentityEnv };
