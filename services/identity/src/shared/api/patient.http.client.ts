import { PatientServiceError, type PatientCards } from '../../entities/registration';
import type { IdentityEnv } from '../config';
import type { ClientCredentialsTokenCache } from './token-cache';

/**
 * HTTP-адаптер patient-service (шаг B саги, 1.4): вызов напрямую,
 * без gateway (architecture.md §165 — сервис → сервис).
 * Несёт client-credentials токен svc-identity — patient принимает его
 * своим guard'ом (защита в глубину, 1.2).
 * Сетевые/5xx-ошибки → PatientServiceError → сага компенсирует шаг A.
 */
export class PatientHttpCards implements PatientCards {
  constructor(
    private readonly env: IdentityEnv,
    private readonly tokens: ClientCredentialsTokenCache,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async findByUserId(userId: string): Promise<{ id: string } | null> {
    const url = `${this.env.PATIENT_SERVICE_URL}/api/patient/by-user/${encodeURIComponent(userId)}`;
    const response = await this.raw('GET', url);

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new PatientServiceError(`GET by-user: HTTP ${response.status}`);
    }

    const card = (await response.json()) as { id?: string };
    if (!card.id) throw new PatientServiceError('в ответе нет id карточки');
    return { id: card.id };
  }

  async create(card: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    birthDate: string;
  }): Promise<{ id: string }> {
    const url = `${this.env.PATIENT_SERVICE_URL}/api/patient`;
    const response = await this.raw('POST', url, {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(card),
    });

    // 200 — карточка уже была (идемпотентность на стороне patient)
    if (!response.ok) {
      throw new PatientServiceError(`POST /api/patient: HTTP ${response.status}`);
    }

    const created = (await response.json()) as { id?: string };
    if (!created.id) throw new PatientServiceError('в ответе нет id карточки');
    return { id: created.id };
  }

  private async raw(
    method: string,
    url: string,
    init: { headers?: Record<string, string>; body?: string } = {},
  ): Promise<Response> {
    try {
      // Токен сервисного аккаунта — patient требует его своим guard'ом (1.2)
      const accessToken = await this.tokens.getToken();
      return await this.fetchImpl(url, {
        method,
        headers: { ...init.headers, authorization: `Bearer ${accessToken}` },
        body: init.body,
        signal: AbortSignal.timeout(this.env.PATIENT_SERVICE_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof PatientServiceError) throw error;
      const detail = error instanceof Error ? error.message : String(error);
      throw new PatientServiceError(detail);
    }
  }
}
