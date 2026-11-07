import type { DoctorByUserResponse, DoctorRelationResponse } from '@mp/contracts';
import { ClientCredentialsTokenCache } from '@mp/service-kit';
import type { AccessPorts } from '../../entities/access';
import type { FileEnv } from '../config';
import { UpstreamError } from '../model';

/**
 * HTTP-клиент scheduling-service (9.3): проверка связи «врач-пациент»
 * (relations/check) и привязка sub → doctorId (relations/doctor/:userId).
 * Вызов токеном svc-file напрямую в сеть контейнеров (не через gateway),
 * таймаут ограничен.
 *
 * Ошибки связи трактуются как «нет связи» (false/null): отсутствие врача
 * не должно ронять запрос файлов — оно превращается в 403 с причиной.
 */
export class SchedulingHttpClient implements Pick<
  AccessPorts,
  'hasDoctorRelation' | 'findDoctorByUser'
> {
  constructor(
    private readonly env: FileEnv,
    private readonly tokens: ClientCredentialsTokenCache,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async hasDoctorRelation(doctorUserId: string, patientId: string): Promise<boolean> {
    const query = new URLSearchParams({ userId: doctorUserId, patientId });
    const url = `${this.env.SCHEDULING_SERVICE_URL}/api/scheduling/relations/check?${query.toString()}`;
    const response = await this.request(url);
    if (response.status === 404) return false;
    if (!response.ok) throw new UpstreamError(`scheduling relations: HTTP ${response.status}`);
    const body = (await response.json()) as DoctorRelationResponse;
    return body.related === true;
  }

  async findDoctorByUser(userId: string): Promise<{ id: string } | null> {
    const url = `${this.env.SCHEDULING_SERVICE_URL}/api/scheduling/relations/doctor/${encodeURIComponent(userId)}`;
    const response = await this.request(url);
    if (response.status === 404) return null;
    if (!response.ok) throw new UpstreamError(`scheduling doctor: HTTP ${response.status}`);
    const body = (await response.json()) as DoctorByUserResponse;
    return { id: body.doctorId };
  }

  private async request(url: string): Promise<Response> {
    const token = await this.tokens.getToken();
    return this.fetchImpl(url, {
      signal: AbortSignal.timeout(this.env.SERVICE_TIMEOUT_MS),
      headers: { authorization: `Bearer ${token}` },
    });
  }
}

/** DI-токен привязки реализации (сборка в shared/api/index.ts). */
export const SCHEDULING_CLIENT = Symbol('FileSchedulingHttpClient');
