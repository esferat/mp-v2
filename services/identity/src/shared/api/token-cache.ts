import type { IdentityEnv } from '../config';

/**
 * Кэш client-credentials токена сервисного аккаунта: нужен и для Admin API
 * (сага), и для service-to-service вызовов (identity → patient, 1.4/1.2).
 * Токен живёт ТОЛЬКО в памяти — в логи и ответы не попадает.
 */
export class ClientCredentialsTokenCache {
  private token: { value: string; expiresAt: number } | null = null;
  private inflight: Promise<string> | null = null;

  constructor(
    private readonly env: IdentityEnv,
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
    const url = `${this.env.KEYCLOAK_INTERNAL_URL}/realms/${this.env.KEYCLOAK_REALM}/protocol/openid-connect/token`;
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.env.KEYCLOAK_SVC_IDENTITY_CLIENT_ID,
        client_secret: this.env.KEYCLOAK_SVC_IDENTITY_SECRET,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Keycloak token: HTTP ${response.status} (проверьте svc-identity секреты)`);
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
