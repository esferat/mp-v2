import { ClientCredentialsTokenCache as ServiceTokenCache } from '@mp/service-kit';
import type { IdentityEnv } from '../config';

/**
 * Кэш client-credentials токена сервисного аккаунта: нужен и для Admin API
 * (сага), и для service-to-service вызовов (identity → patient, 1.4/1.2).
 *
 * Реализация общая (service-kit, DRY); здесь только привязка кредов
 * svc-identity к типу окружения сервиса. Токен живёт ТОЛЬКО в памяти.
 */
export class ClientCredentialsTokenCache extends ServiceTokenCache {
  constructor(env: IdentityEnv, fetchImpl: typeof fetch = fetch) {
    super(
      {
        keycloakInternalUrl: env.KEYCLOAK_INTERNAL_URL,
        realm: env.KEYCLOAK_REALM,
        clientId: env.KEYCLOAK_SVC_IDENTITY_CLIENT_ID,
        clientSecret: env.KEYCLOAK_SVC_IDENTITY_SECRET,
      },
      fetchImpl,
    );
  }
}
