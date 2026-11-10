import type { Patient } from '@mp/contracts';
import { ClientCredentialsTokenCache, TransientConsumerError } from '@mp/service-kit';
import type { PatientEmailInfo, PatientEmailSource } from '../../entities/mail';
import type { NotificationEnv } from '../config';

/**
 * Резолв получателя письма (6.2): в событиях appointment.* email не денализован
 * (PII, architecture §6) — notification запрашивает карточку пациента по внутреннему
 * маршруту `GET /api/patient/internal/:id` (svc-backend, как в scheduling 5.3).
 *
 * Ошибки сети/5xx → TransientConsumerError: сообщение возвращается в очередь и
 * доставляется после восстановления patient-service (без потерь).
 */
export class PatientHttpClient implements PatientEmailSource {
  private readonly tokens: ClientCredentialsTokenCache;

  constructor(
    private readonly env: NotificationEnv,
    tokens: ClientCredentialsTokenCache,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.tokens = tokens;
  }

  async findById(patientId: string): Promise<PatientEmailInfo | null> {
    const url = `${this.env.PATIENT_SERVICE_URL}/api/patient/internal/${encodeURIComponent(patientId)}`;
    let response: Response;
    try {
      const token = await this.tokens.getToken();
      response = await this.fetchImpl(url, {
        signal: AbortSignal.timeout(this.env.SERVICE_TIMEOUT_MS),
        headers: { authorization: `Bearer ${token}` },
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new TransientConsumerError(`patient-service недоступен: ${detail}`);
    }

    if (response.status === 404) return null; // карточки нет — письмо не отправляется
    if (!response.ok) {
      throw new TransientConsumerError(`patient-service: HTTP ${response.status}`);
    }

    const patient = (await response.json()) as Patient;
    return {
      email: patient.email,
      firstName: patient.firstName,
      lastName: patient.lastName,
      ...(patient.middleName ? { middleName: patient.middleName } : {}),
      userId: patient.userId,
    };
  }
}
