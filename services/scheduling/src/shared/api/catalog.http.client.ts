import type { DoctorListItem, DoctorListResponse } from '@mp/contracts';
import { ClientCredentialsTokenCache } from '@mp/service-kit';
import type { SchedulingEnv } from '../config';
import { UpstreamError } from '../model';

/**
 * HTTP-клиент catalog-service (5.1): bootstrap копий расписания при пустом
 * read-model и fallback при расхождении (3.5: catalog спрашивается
 * синхронно, расхождение логируется).
 */
export class CatalogHttpClient {
  constructor(
    private readonly env: SchedulingEnv,
    private readonly tokens: ClientCredentialsTokenCache,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /** Страница списка врачей (limit до 100 — размер каталога MVP). */
  async listDoctors(limit = 100): Promise<DoctorListItem[]> {
    const url = `${this.env.CATALOG_SERVICE_URL}/api/catalog/doctors?limit=${limit}`;
    const response = await this.request(url);
    if (!response.ok) throw new UpstreamError(`catalog doctors: HTTP ${response.status}`);
    const body = (await response.json()) as DoctorListResponse;
    return body.items;
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.tokens.getToken();
    return this.fetchImpl(url, {
      ...init,
      signal: AbortSignal.timeout(this.env.SERVICE_TIMEOUT_MS),
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        authorization: `Bearer ${token}`,
      },
    });
  }
}

/** DI-токен привязки реализации (сборка в shared/api/index.ts). */
export const CATALOG_CLIENT = Symbol('SchedulingCatalogHttpClient');
