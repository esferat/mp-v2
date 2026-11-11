import type { DoctorListItem } from '@mp/contracts';
import { ClientCredentialsTokenCache } from '@mp/service-kit';
import type { IdentityEnv } from '../config';
import { ConflictError, NotFoundError, UpstreamError } from '../model';

/**
 * HTTP-клиент catalog-service (9.1: шаг B саги врача): создание врача
 * с userId. Вызов токеном svc-identity (как identity → patient, 1.4),
 * таймаут ограничен.
 */
export class CatalogHttpClient {
  constructor(
    private readonly env: IdentityEnv,
    private readonly tokens: ClientCredentialsTokenCache,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async createDoctor(body: {
    userId: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    specializationId: string;
    schedule: {
      startTime: string;
      endTime: string;
      durationMinutes: number;
      workDays: number[];
    };
  }): Promise<{ id: string }> {
    const url = `${this.env.CATALOG_SERVICE_URL}/api/catalog/doctors`;
    const token = await this.tokens.getToken();
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.env.PATIENT_SERVICE_TIMEOUT_MS),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new UpstreamError(
        `catalog createDoctor: HTTP ${response.status} ${detail.slice(0, 200)}`,
      );
    }
    const doctor = (await response.json()) as DoctorListItem;
    return { id: doctor.id };
  }

  /** Существующий врач по userId (9.1: идемпотентный повтор); 404 → null. */
  async findDoctorByUser(userId: string): Promise<{ id: string } | null> {
    const url = `${this.env.CATALOG_SERVICE_URL}/api/catalog/doctors/by-user/${encodeURIComponent(userId)}`;
    const token = await this.tokens.getToken();
    const response = await this.fetchImpl(url, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(this.env.PATIENT_SERVICE_TIMEOUT_MS),
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new UpstreamError(`catalog findDoctorByUser: HTTP ${response.status}`);
    }
    const doctor = (await response.json()) as DoctorListItem;
    return { id: doctor.id };
  }

  /**
   * Привязка userId к УЖЕ существующему карточке врача (правило «учётная
   * запись создаётся администратором всегда»).404 → NotFoundError,
   * 409 → ConflictError (сообщение каталога — подсказка админу).
   */
  async linkDoctorUser(doctorId: string, userId: string): Promise<void> {
    const url = `${this.env.CATALOG_SERVICE_URL}/api/catalog/doctors/${encodeURIComponent(doctorId)}/user`;
    const token = await this.tokens.getToken();
    const response = await this.fetchImpl(url, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId }),
      signal: AbortSignal.timeout(this.env.PATIENT_SERVICE_TIMEOUT_MS),
    });
    if (response.ok) return;

    const detail = await response.text().catch(() => '');
    let message =
      response.status === 404 ? `Врач ${doctorId} не найден` : 'Привязка учётной записи невозможна';
    let field: string | undefined;
    try {
      const body = JSON.parse(detail) as { message?: string; field?: string };
      if (body.message) message = body.message;
      field = body.field;
    } catch {
      // не-JSON тело — оставляем сообщение по умолчанию
    }
    if (response.status === 404) throw new NotFoundError(message);
    if (response.status === 409) throw new ConflictError(message, field ? { field } : undefined);
    throw new UpstreamError(
      `catalog linkDoctorUser: HTTP ${response.status} ${detail.slice(0, 200)}`,
    );
  }
}
