import type {
  Appointment,
  AppointmentListQuery,
  AppointmentListResponse,
  BookAppointmentRequest,
  CancelAppointmentRequest,
  CreateDoctorRequest,
  CreateSpecializationRequest,
  DoctorListItem,
  DoctorListQuery,
  DoctorListResponse,
  DoctorPatientList,
  DoctorSchedule,
  EnterVisitResultRequest,
  FileDownload,
  FileListQuery,
  FileListResponse,
  MeProfile,
  Patient,
  PatientListQuery,
  PatientListResponse,
  RegisterDoctorRequest,
  RegisterDoctorResponse,
  RegisterRequest,
  RegisterResponse,
  RescheduleAppointmentRequest,
  SetAppointmentStatusRequest,
  SlotList,
  Specialization,
  UpdateDoctorRequest,
  UpdateDoctorScheduleRequest,
  UpdateMeRequest,
  UpdatePatientRequest,
  UpdateVisitResultRequest,
  VisitResult,
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
      /** Создание специализации (3.3): дубликат (case-insensitive) → 409. */
      createSpecialization: (body: CreateSpecializationRequest) =>
        client.post<Specialization>('/catalog/specializations', body, { noRetry: true }),
      /** Удаление свободной специализации; занятая → 409 с числом врачей (3.3). */
      deleteSpecialization: (id: string) =>
        client.del<{ ok: true }>(`/catalog/specializations/${encodeURIComponent(id)}`, {
          noRetry: true,
        }),
      /** Список врачей: поиск + фильтры специализации/статуса (3.1). */
      getDoctors: (params?: Partial<DoctorListQuery>) => {
        const query = new URLSearchParams();
        if (params?.search) query.set('search', params.search);
        if (params?.specId) query.set('specId', params.specId);
        if (params?.status) query.set('status', params.status);
        if (params?.offset !== undefined) query.set('offset', String(params.offset));
        if (params?.limit !== undefined) query.set('limit', String(params.limit));
        const suffix = query.toString();
        return client.get<DoctorListResponse>(`/catalog/doctors${suffix ? `?${suffix}` : ''}`);
      },
      createDoctor: (body: CreateDoctorRequest) =>
        client.post<DoctorListItem>('/catalog/doctors', body),
      getDoctor: (id: string) =>
        client.get<DoctorListItem>(`/catalog/doctors/${encodeURIComponent(id)}`),
      updateDoctor: (id: string, body: UpdateDoctorRequest) =>
        client.put<DoctorListItem>(`/catalog/doctors/${encodeURIComponent(id)}`, body),
      /** Карточка своего врача по токену (10.4: форма расписания). */
      getMyDoctor: () => client.get<DoctorListItem>('/catalog/doctors/me'),
      /** Расписание своей карточки (10.4): sub из токена, id не нужен. */
      updateMySchedule: (body: UpdateDoctorScheduleRequest) =>
        client.put<DoctorListItem>('/catalog/doctors/me/schedule', body, { noRetry: true }),
    },

    identity: {
      /** Регистрация (сага 1.4). */
      register: (body: RegisterRequest) =>
        client.post<RegisterResponse>('/identity/register', body, { noRetry: true }),
      /** Сага врача с учётной записью DOCTOR (9.1, только ADMIN). */
      registerDoctor: (body: RegisterDoctorRequest) =>
        client.post<RegisterDoctorResponse>('/identity/doctors', body, { noRetry: true }),
      /** Профиль текущего пользователя (10.1: email/ФИО из Keycloak). */
      getMe: () => client.get<MeProfile>('/identity/me'),
      /** Правка СВОИХ данных (10.1: занятый email → 409 с полем email). */
      updateMe: (body: UpdateMeRequest) =>
        client.patch<MeProfile>('/identity/me', body, { noRetry: true }),
    },

    patient: {
      getByUser: (userId: string) =>
        client.get<Patient>(`/patient/by-user/${encodeURIComponent(userId)}`),
      /** Карточка по id (4.2: ADMIN или владелец — проверяет сервис). */
      get: (id: string) => client.get<Patient>(`/patient/${encodeURIComponent(id)}`),
      /** Обновление карточки (4.2). */
      update: (id: string, body: UpdatePatientRequest) =>
        client.put<Patient>(`/patient/${encodeURIComponent(id)}`, body),
      /** Админский список с поиском (4.1). */
      list: (params: PatientListQuery) => {
        const query = new URLSearchParams({
          offset: String(params.offset),
          limit: String(params.limit),
        });
        if (params.search) query.set('search', params.search);
        return client.get<PatientListResponse>(`/patients?${query.toString()}`);
      },
    },

    files: {
      /** Список документов владельца (4.5/9.3). */
      list: (params: FileListQuery) => {
        const query = new URLSearchParams({
          ownerType: params.ownerType,
          ownerId: params.ownerId,
        });
        return client.get<FileListResponse>(`/files?${query.toString()}`);
      },
      /** Presigned-ссылка на скачивание (4.5). */
      getLink: (key: string) => client.get<FileDownload>(`/files/${encodeURIComponent(key)}`),
    },

    scheduling: {
      /** Свободные слоты по специализации (5.2). */
      getSlots: (params: { specId: string; from: string; to: string }) => {
        const query = new URLSearchParams({
          specId: params.specId,
          from: params.from,
          to: params.to,
        });
        return client.get<SlotList>(`/scheduling/slots?${query.toString()}`);
      },
      /** Расписание врача из копии (10.3 UI: недельный вид слотов переноса). */
      getDoctorSchedule: (doctorId: string) =>
        client.get<DoctorSchedule>(`/scheduling/doctors/${encodeURIComponent(doctorId)}/schedule`),
      /** Бронь слота (5.3): patientId — из токена или явно у админа. */
      bookAppointment: (body: BookAppointmentRequest) =>
        client.post<Appointment>('/scheduling/appointments', body, { noRetry: true }),
      /** Список записей с фильтрами (5.4, админ). */
      getAppointments: (params: AppointmentListQuery) => {
        const query = new URLSearchParams({
          offset: String(params.offset),
          limit: String(params.limit),
        });
        if (params.status) query.set('status', params.status);
        if (params.specId) query.set('specId', params.specId);
        // Мультивыбор специализаций/врачей (админ-фильтры) — строка «id1,id2»
        if (params.specIds?.length) query.set('specIds', params.specIds.join(','));
        if (params.doctorId) query.set('doctorId', params.doctorId);
        if (params.doctorIds?.length) query.set('doctorIds', params.doctorIds.join(','));
        if (params.patientId) query.set('patientId', params.patientId);
        if (params.from) query.set('from', params.from);
        if (params.to) query.set('to', params.to);
        return client.get<AppointmentListResponse>(`/scheduling/appointments?${query.toString()}`);
      },
      /** Перенос записи без смены статуса (10.3, только ADMIN). */
      rescheduleAppointment: (id: string, body: RescheduleAppointmentRequest) =>
        client.put<Appointment>(
          `/scheduling/appointments/${encodeURIComponent(id)}/reschedule`,
          body,
          { noRetry: true },
        ),
      /** История пациента (5.5): patientId сервер берёт из токена. */
      getMyAppointments: (params: AppointmentListQuery) => {
        const query = new URLSearchParams({
          offset: String(params.offset),
          limit: String(params.limit),
        });
        if (params.status) query.set('status', params.status);
        if (params.specId) query.set('specId', params.specId);
        if (params.from) query.set('from', params.from);
        if (params.to) query.set('to', params.to);
        return client.get<AppointmentListResponse>(
          `/scheduling/appointments/me?${query.toString()}`,
        );
      },
      /** APPROVED / DECLINED (5.4). */
      setAppointmentStatus: (id: string, body: SetAppointmentStatusRequest) =>
        client.put<Appointment>(`/scheduling/appointments/${encodeURIComponent(id)}/status`, body, {
          noRetry: true,
        }),
      /** Отмена записи (5.4). */
      cancelAppointment: (id: string, body: CancelAppointmentRequest) =>
        client.put<Appointment>(`/scheduling/appointments/${encodeURIComponent(id)}/cancel`, body, {
          noRetry: true,
        }),

      // --- Кабинет врача (9.2/9.3) ------------------------------------------
      /** Приёмы врача: doctorId сервер берёт из привязки sub (9.2). */
      getDoctorAppointments: (params: AppointmentListQuery) => {
        const query = new URLSearchParams({
          offset: String(params.offset),
          limit: String(params.limit),
        });
        if (params.status) query.set('status', params.status);
        if (params.from) query.set('from', params.from);
        if (params.to) query.set('to', params.to);
        return client.get<AppointmentListResponse>(
          `/scheduling/appointments/doctor?${query.toString()}`,
        );
      },
      /** Пациенты врача: distinct из его записей (9.3). */
      getDoctorPatients: () =>
        client.get<DoctorPatientList>('/scheduling/appointments/doctor/patients'),
      /** Внести результат приёма: APPROVED → COMPLETED (9.2). */
      enterVisitResult: (id: string, body: EnterVisitResultRequest) =>
        client.post<VisitResult>(
          `/scheduling/appointments/${encodeURIComponent(id)}/result`,
          body,
          {
            noRetry: true,
          },
        ),
      /** Результат приёма (9.2): только врач записи. */
      getVisitResult: (id: string) =>
        client.get<VisitResult>(`/scheduling/appointments/${encodeURIComponent(id)}/result`),
      /** Правка результата (9.2): только врач записи. */
      updateVisitResult: (id: string, body: UpdateVisitResultRequest) =>
        client.put<VisitResult>(`/scheduling/appointments/${encodeURIComponent(id)}/result`, body, {
          noRetry: true,
        }),
    },
  };
}

export type Api = ReturnType<typeof createApi>;
