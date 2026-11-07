/**
 * Кэш client-credentials токена сервисного аккаунта (1.2/4.4): нужен для
 * Admin API (саги) и service-to-service вызовов (file → patient/catalog).
 * Токен живёт ТОЛЬКО в памяти — в логи и ответы не попадает.
 *
 * Общая реализация для всех сервисов (DRY): каждый сервис передаёт
 * креды своего svc-клиента Keycloak.
 */
export interface ServiceAccountCredentials {
  /** Внутренний адрес Keycloak (в контейнере http://keycloak:8080). */
  keycloakInternalUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
}

export class ClientCredentialsTokenCache {
  private token: { value: string; expiresAt: number } | null = null;
  private inflight: Promise<string> | null = null;

  constructor(
    private readonly credentials: ServiceAccountCredentials,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /** Валидный access-токен (кэшируется до истечения минус 30 с). */
  getToken(): Promise<string> {
    if (this.token && this.token.expiresAt - Date.now() > 30_000) {
      return Promise.resolve(this.token.value);
    }
    // Один запрос на все параллельные вызовы
    this.inflight ??= this.fetchToken().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async fetchToken(): Promise<string> {
    const { keycloakInternalUrl, realm, clientId, clientSecret } = this.credentials;
    const url = `${keycloakInternalUrl}/realms/${realm}/protocol/openid-connect/token`;
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Keycloak token: HTTP ${response.status} (проверьте секреты ${clientId})`);
    }
    const payload = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.token = {
      value: payload.access_token,
      expiresAt: Date.now() + payload.expires_in * 1000,
    };
    return this.token.value;
  }
}
