import type { SetPhotoResponse } from '@mp/contracts';
import { ClientCredentialsTokenCache } from '@mp/service-kit';
import type { FileEnv } from '../config';
import { UpstreamError } from '../model';

/**
 * HTTP-клиент catalog-service (3.4): привязка фото врача после загрузки
 * (file → catalog, идемпотентно), токен svc-file, таймаут ограничен.
 */
export class CatalogHttpClient {
  constructor(
    private readonly env: FileEnv,
    private readonly tokens: ClientCredentialsTokenCache,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /** Привязка фото врача: key = null очищает фото. */
  async setDoctorPhoto(doctorId: string, key: string | null): Promise<SetPhotoResponse> {
    const url = `${this.env.CATALOG_SERVICE_URL}/api/catalog/doctors/${encodeURIComponent(doctorId)}/photo`;
    const response = await this.request(url, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    if (!response.ok) throw new UpstreamError(`catalog photo: HTTP ${response.status}`);
    return (await response.json()) as SetPhotoResponse;
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
export const CATALOG_CLIENT = Symbol('FileCatalogHttpClient');
