import type { Patient } from '@mp/contracts';
import { ClientCredentialsTokenCache } from '@mp/service-kit';
import type { SchedulingEnv } from '../config';
import { UpstreamError } from '../model';

/**
 * HTTP-клиент patient-service (5.3/5.5): пациент по Keycloak sub —
 * для бронирования (снапшот ФИО, проверка существования) и истории
 * (patientId из токена). Вызов токеном svc-backend, таймаут ограничен.
 */
export class PatientHttpClient {
  constructor(
    private readonly env: SchedulingEnv,
    private readonly tokens: ClientCredentialsTokenCache,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /** Карточка пациента по sub; null — карточки нет (404 от patient). */
  async findByUser(userId: string): Promise<Patient | null> {
    const url = `${this.env.PATIENT_SERVICE_URL}/api/patient/by-user/${encodeURIComponent(userId)}`;
    const response = await this.request(url);
    if (response.status === 404) return null;
    if (!response.ok) throw new UpstreamError(`patient-service: HTTP ${response.status}`);
    return (await response.json()) as Patient;
  }

  /** Карточка по id (бронь админом, 5.3); null — не найдена. */
  async findById(patientId: string): Promise<Patient | null> {
    // Внутренний маршрут (5.3/9.3): svc-backend не проходит ролевой фильтр getPatient
    const url = `${this.env.PATIENT_SERVICE_URL}/api/patient/internal/${encodeURIComponent(patientId)}`;
    const response = await this.request(url);
    if (response.status === 404) return null;
    if (!response.ok) throw new UpstreamError(`patient-service: HTTP ${response.status}`);
    return (await response.json()) as Patient;
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
export const PATIENT_CLIENT = Symbol('SchedulingPatientHttpClient');
