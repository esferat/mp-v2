import type { SetPhotoResponse } from '@mp/contracts';
import { ClientCredentialsTokenCache } from '@mp/service-kit';
import type { FileEnv } from '../config';
import { UpstreamError } from '../model';

/**
 * HTTP-клиент patient-service (4.4): вызывается токеном svc-file
 * (client credentials, токен кэшируется, ответы ограничены таймаутом).
 * В порт AccessPorts входит через AccessPortsComposite (9.3).
 */
export class PatientHttpClient {
  constructor(
    private readonly env: FileEnv,
    private readonly tokens: ClientCredentialsTokenCache,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async findPatientByUser(userId: string): Promise<{ id: string } | null> {
    const url = `${this.env.PATIENT_SERVICE_URL}/api/patient/by-user/${encodeURIComponent(userId)}`;
    const response = await this.request(url);
    if (response.status === 404) return null;
    if (!response.ok) throw new UpstreamError(`patient-service: HTTP ${response.status}`);
    const body = (await response.json()) as { id: string };
    return { id: body.id };
  }

  /** Привязка фото пациента (4.3): key = null очищает фото. */
  async setPhoto(patientId: string, key: string | null): Promise<SetPhotoResponse> {
    const url = `${this.env.PATIENT_SERVICE_URL}/api/patient/${encodeURIComponent(patientId)}/photo`;
    const response = await this.request(url, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    if (!response.ok) throw new UpstreamError(`patient-service photo: HTTP ${response.status}`);
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
export const PATIENT_CLIENT = Symbol('FilePatientHttpClient');
