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
  Specialization: catalog.specializationSchema,
  CreateSpecializationRequest: catalog.createSpecializationSchema,
  SlotsQuery: scheduling.slotsQuerySchema,
  SlotList: scheduling.slotListSchema,
  BookAppointmentRequest: scheduling.bookAppointmentSchema,
  Appointment: scheduling.appointmentSchema,
  AppointmentListQuery: scheduling.appointmentListQuerySchema,
  SetAppointmentStatusRequest: scheduling.setAppointmentStatusSchema,
  RegisterRequest: identity.registerRequestSchema,
  RegisterResponse: identity.registerResponseSchema,
  Patient: patient.patientSchema,
  CreatePatientRequest: patient.createPatientRequestSchema,
  UploadFileResponse: patient.uploadFileResponseSchema,
  FileDownload: patient.fileDownloadSchema,
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
    response: 'array:Appointment',
  },
  {
    method: 'get',
    path: '/api/scheduling/appointments/me',
    tag: 'scheduling',
    summary: 'История записей пациента (patientId из токена)',
    query: 'PaginationQuery',
    response: 'array:Appointment',
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
    method: 'post',
    path: '/api/identity/register',
    tag: 'identity',
    summary: 'Регистрация (сага: Keycloak + карточка пациента)',
    body: 'RegisterRequest',
    response: 'RegisterResponse',
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
];
