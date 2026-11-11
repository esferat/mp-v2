import * as catalog from './catalog';
import * as common from './common';
import * as identity from './identity';
import * as patient from './patient';
import * as scheduling from './scheduling';

export * from './catalog';
export * from './common';
export * from './identity';
export * from './patient';
export * from './scheduling';

/**
 * Реестр HTTP-контрактов gateway (0.6): именованные схемы для components/schemas
 * и таблица маршрутов для генерации OpenAPI. Типы потребители получают через
 * z.infer из этих же схем — дублирования руками нет.
 */
export const apiSchemas = {
  ApiError: common.apiErrorSchema,
  PaginationQuery: common.paginationQuerySchema,
  Ok: common.okSchema,
  DoctorListItem: catalog.doctorListItemSchema,
  DoctorListQuery: catalog.doctorListQuerySchema,
  DoctorListResponse: catalog.doctorListResponseSchema,
  CreateDoctorRequest: catalog.createDoctorSchema,
  UpdateDoctorRequest: catalog.updateDoctorSchema,
  UpdateDoctorScheduleRequest: catalog.updateDoctorScheduleSchema,
  Specialization: catalog.specializationSchema,
  CreateSpecializationRequest: catalog.createSpecializationSchema,
  SlotsQuery: scheduling.slotsQuerySchema,
  SlotList: scheduling.slotListSchema,
  BookAppointmentRequest: scheduling.bookAppointmentSchema,
  Appointment: scheduling.appointmentSchema,
  AppointmentListQuery: scheduling.appointmentListQuerySchema,
  AppointmentListResponse: scheduling.appointmentListResponseSchema,
  SetAppointmentStatusRequest: scheduling.setAppointmentStatusSchema,
  CancelAppointmentRequest: scheduling.cancelAppointmentSchema,
  EnterVisitResultRequest: scheduling.enterVisitResultSchema,
  UpdateVisitResultRequest: scheduling.updateVisitResultSchema,
  VisitResult: scheduling.visitResultSchema,
  DoctorPatient: scheduling.doctorPatientSchema,
  DoctorPatientList: scheduling.doctorPatientListSchema,
  DoctorRelationQuery: scheduling.doctorRelationQuerySchema,
  DoctorRelationResponse: scheduling.doctorRelationResponseSchema,
  DoctorByUserResponse: scheduling.doctorByUserResponseSchema,
  RegisterRequest: identity.registerRequestSchema,
  RegisterResponse: identity.registerResponseSchema,
  RegisterDoctorRequest: identity.registerDoctorRequestSchema,
  RegisterDoctorResponse: identity.registerDoctorResponseSchema,
  MeProfile: identity.meProfileSchema,
  UpdateMeRequest: identity.updateMeSchema,
  AdminUserProfile: identity.adminUserProfileSchema,
  UpdateAdminUserProfileRequest: identity.updateAdminUserProfileSchema,
  RescheduleAppointmentRequest: scheduling.rescheduleAppointmentSchema,
  DoctorScheduleResponse: scheduling.doctorScheduleResponseSchema,
  Patient: patient.patientSchema,
  CreatePatientRequest: patient.createPatientRequestSchema,
  UpdatePatientRequest: patient.updatePatientRequestSchema,
  PatientListQuery: patient.patientListQuerySchema,
  PatientListItem: patient.patientListItemSchema,
  PatientListResponse: patient.patientListResponseSchema,
  UploadFileResponse: patient.uploadFileResponseSchema,
  FileDownload: patient.fileDownloadSchema,
  FileMeta: patient.fileMetaSchema,
  FileListQuery: patient.fileListQuerySchema,
  FileListResponse: patient.fileListResponseSchema,
} as const;

export type ApiSchemaName = keyof typeof apiSchemas;

interface ApiRoute {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  tag: string;
  summary: string;
  query?: keyof typeof apiSchemas;
  body?: keyof typeof apiSchemas;
  response: keyof typeof apiSchemas | `array:${ApiSchemaName}`;
}

/** Таблица маршрутов gateway (полный OpenAPI-обход генерируется из неё). */
export const apiRoutes: readonly ApiRoute[] = [
  {
    method: 'get',
    path: '/api/catalog/doctors',
    tag: 'catalog',
    summary: 'Список врачей с поиском и пагинацией',
    query: 'DoctorListQuery',
    response: 'DoctorListResponse',
  },
  {
    method: 'get',
    path: '/api/catalog/doctors/:id',
    tag: 'catalog',
    summary: 'Карточка врача (форма редактирования, 3.2)',
    response: 'DoctorListItem',
  },
  {
    method: 'get',
    path: '/api/catalog/doctors/by-user/:userId',
    tag: 'catalog',
    summary: 'Врач по Keycloak sub (9.1: идемпотентность саги, 9.3)',
    response: 'DoctorListItem',
  },
  {
    method: 'post',
    path: '/api/catalog/doctors',
    tag: 'catalog',
    summary: 'Создать врача с расписанием',
    body: 'CreateDoctorRequest',
    response: 'DoctorListItem',
  },
  {
    method: 'put',
    path: '/api/catalog/doctors/:id',
    tag: 'catalog',
    summary: 'Редактировать врача',
    body: 'UpdateDoctorRequest',
    response: 'DoctorListItem',
  },
  {
    method: 'get',
    path: '/api/catalog/doctors/me',
    tag: 'catalog',
    summary: 'Карточка своего врача по токену (10.4: форма расписания)',
    response: 'DoctorListItem',
  },
  {
    method: 'put',
    path: '/api/catalog/doctors/me/schedule',
    tag: 'catalog',
    summary: 'Расписание врача (10.4: врач правит своё, sub из токена)',
    body: 'UpdateDoctorScheduleRequest',
    response: 'DoctorListItem',
  },
  {
    method: 'get',
    path: '/api/catalog/specializations',
    tag: 'catalog',
    summary: 'Список специализаций',
    response: 'array:Specialization',
  },
  {
    method: 'post',
    path: '/api/catalog/specializations',
    tag: 'catalog',
    summary: 'Создать специализацию',
    body: 'CreateSpecializationRequest',
    response: 'Specialization',
  },
  {
    method: 'delete',
    path: '/api/catalog/specializations/:id',
    tag: 'catalog',
    summary: 'Удалить свободную специализацию (занятая → 409)',
    response: 'Ok',
  },
  {
    method: 'get',
    path: '/api/scheduling/slots',
    tag: 'scheduling',
    summary: 'Свободные слоты по специализации',
    query: 'SlotsQuery',
    response: 'array:SlotList',
  },
  {
    method: 'post',
    path: '/api/scheduling/appointments',
    tag: 'scheduling',
    summary: 'Забронировать слот (гонка → 409 SLOT_TAKEN)',
    body: 'BookAppointmentRequest',
    response: 'Appointment',
  },
  {
    method: 'get',
    path: '/api/scheduling/appointments',
    tag: 'scheduling',
    summary: 'Записи с фильтрами (админ)',
    query: 'AppointmentListQuery',
    response: 'AppointmentListResponse',
  },
  {
    method: 'get',
    path: '/api/scheduling/doctors/:id/schedule',
    tag: 'scheduling',
    summary: 'Расписание врача из копии (10.3: недельный вид слотов переноса)',
    response: 'DoctorScheduleResponse',
  },
  {
    method: 'put',
    path: '/api/scheduling/appointments/:id/reschedule',
    tag: 'scheduling',
    summary: 'Перенос записи без смены статуса (10.3, только ADMIN)',
    body: 'RescheduleAppointmentRequest',
    response: 'Appointment',
  },
  {
    method: 'get',
    path: '/api/scheduling/appointments/me',
    tag: 'scheduling',
    summary: 'История записей пациента (patientId строго из токена, 5.5)',
    query: 'AppointmentListQuery',
    response: 'AppointmentListResponse',
  },
  {
    method: 'put',
    path: '/api/scheduling/appointments/:id/status',
    tag: 'scheduling',
    summary: 'APPROVED / DECLINED (только из SUBMITTED)',
    body: 'SetAppointmentStatusRequest',
    response: 'Appointment',
  },
  {
    method: 'put',
    path: '/api/scheduling/appointments/:id/cancel',
    tag: 'scheduling',
    summary: 'Отмена записи (из SUBMITTED или APPROVED, 5.4)',
    body: 'CancelAppointmentRequest',
    response: 'Appointment',
  },
  {
    method: 'get',
    path: '/api/scheduling/appointments/doctor',
    tag: 'scheduling',
    summary: 'Приёмы врача (9.2: doctorId из привязки sub, свои записи)',
    query: 'AppointmentListQuery',
    response: 'AppointmentListResponse',
  },
  {
    method: 'get',
    path: '/api/scheduling/appointments/doctor/patients',
    tag: 'scheduling',
    summary: 'Пациенты врача (9.3: distinct из записей)',
    response: 'DoctorPatientList',
  },
  {
    method: 'post',
    path: '/api/scheduling/appointments/:id/result',
    tag: 'scheduling',
    summary: 'Внести результат приёма (9.2: APPROVED → COMPLETED)',
    body: 'EnterVisitResultRequest',
    response: 'VisitResult',
  },
  {
    method: 'get',
    path: '/api/scheduling/appointments/:id/result',
    tag: 'scheduling',
    summary: 'Результат приёма (9.2: врач записи или ADMIN)',
    response: 'VisitResult',
  },
  {
    method: 'put',
    path: '/api/scheduling/appointments/:id/result',
    tag: 'scheduling',
    summary: 'Правка результата (9.2: только врач записи)',
    body: 'UpdateVisitResultRequest',
    response: 'VisitResult',
  },
  {
    method: 'post',
    path: '/api/identity/register',
    tag: 'identity',
    summary: 'Регистрация (сага: Keycloak + карточка пациента)',
    body: 'RegisterRequest',
    response: 'RegisterResponse',
  },
  {
    method: 'post',
    path: '/api/identity/doctors',
    tag: 'identity',
    summary: 'Сага врача с учётной записью DOCTOR (9.1, только ADMIN)',
    body: 'RegisterDoctorRequest',
    response: 'RegisterDoctorResponse',
  },
  {
    method: 'get',
    path: '/api/identity/me',
    tag: 'identity',
    summary: 'Профиль текущего пользователя (10.1: email/ФИО из Keycloak)',
    response: 'MeProfile',
  },
  {
    method: 'patch',
    path: '/api/identity/me',
    tag: 'identity',
    summary: 'Правка своих данных (10.1: email/ФИО, занятый email → 409)',
    body: 'UpdateMeRequest',
    response: 'MeProfile',
  },
  {
    method: 'get',
    path: '/api/identity/users/:userId',
    tag: 'identity',
    summary: 'Профиль пользователя для админки (3.2: email врача, только ADMIN)',
    response: 'AdminUserProfile',
  },
  {
    method: 'patch',
    path: '/api/identity/users/:userId',
    tag: 'identity',
    summary: 'Правка профиля пользователя админом (email; занятый → 409)',
    body: 'UpdateAdminUserProfileRequest',
    response: 'AdminUserProfile',
  },
  {
    method: 'get',
    path: '/api/patient/by-user/:userId',
    tag: 'patient',
    summary: 'Карточка пациента по Keycloak sub (сага/профиль)',
    response: 'Patient',
  },
  {
    method: 'get',
    path: '/api/patient/:id',
    tag: 'patient',
    summary: 'Карточка пациента по id (4.2: ADMIN или владелец)',
    response: 'Patient',
  },
  {
    method: 'put',
    path: '/api/patient/:id',
    tag: 'patient',
    summary: 'Обновление карточки (4.2: ADMIN или владелец, id сверяется)',
    body: 'UpdatePatientRequest',
    response: 'Patient',
  },
  {
    method: 'get',
    path: '/api/patients',
    tag: 'patient',
    summary: 'Админский список пациентов с поиском и пагинацией (4.1)',
    query: 'PatientListQuery',
    response: 'PatientListResponse',
  },
  {
    method: 'get',
    path: '/api/files',
    tag: 'file',
    summary: 'Список файлов владельца (4.5/9.3: владелец или ADMIN)',
    query: 'FileListQuery',
    response: 'FileListResponse',
  },
  {
    method: 'post',
    path: '/api/files/upload',
    tag: 'file',
    summary: 'Загрузка файла (multipart, валидация MIME/размера)',
    response: 'UploadFileResponse',
  },
  {
    method: 'get',
    path: '/api/files/:key',
    tag: 'file',
    summary: 'Presigned URL на скачивание (TTL 5 мин)',
    response: 'FileDownload',
  },
  {
    method: 'delete',
    path: '/api/files/:key',
    tag: 'file',
    summary: 'Удалить файл (владелец или ADMIN, 4.4)',
    response: 'Ok',
  },
];
