import type {
  DoctorListItem,
  DoctorListResponse,
  RegisterRequest,
  RegisterResponse,
  Specialization,
  Patient,
} from '@mp/contracts';
import type { ApiClient } from './client';

/**
 * Namespace-функции API (задача 2.3): типы — только из @mp/contracts,
 * «изменение контракта ломает компиляцию» (AC). Клиент передаётся снаружи —
 * одни и те же вызовы работают и в браузере (/api/bff), и на сервере (gateway).
 */
export function createApi(client: ApiClient) {
  return {
    catalog: {
      getSpecializations: () => client.get<Specialization[]>('/catalog/specializations'),
      getDoctors: (params?: { search?: string; offset?: number; limit?: number }) => {
        const query = new URLSearchParams();
        if (params?.search) query.set('search', params.search);
        if (params?.offset !== undefined) query.set('offset', String(params.offset));
        if (params?.limit !== undefined) query.set('limit', String(params.limit));
        const suffix = query.toString();
        return client.get<DoctorListResponse>(`/catalog/doctors${suffix ? `?${suffix}` : ''}`);
      },
      createDoctor: (body: unknown) => client.post<DoctorListItem>('/catalog/doctors', body),
    },

    identity: {
      /** Регистрация (сага 1.4). */
      register: (body: RegisterRequest) =>
        client.post<RegisterResponse>('/identity/register', body, { noRetry: true }),
    },

    patient: {
      getByUser: (userId: string) =>
        client.get<Patient>(`/patient/by-user/${encodeURIComponent(userId)}`),
    },
  };
}

export type Api = ReturnType<typeof createApi>;
