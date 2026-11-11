import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import type { AppointmentListResponse } from '@mp/contracts';
import { Alert, Box, MpPageHeader, Typography } from '@/shared/ui';
import { ApiError, createServerApi } from '@/shared/api';
import { DoctorPatientAppointments } from '@/widgets/doctor-patient-appointments';
import { DoctorPatientDocuments } from '@/widgets/doctor-patient-documents';

export const metadata: Metadata = { title: 'Карточка пациента — Кабинет' };

/** Первая страница приёмов пациента (в виджете — та же граница LIMIT). */
const APPOINTMENTS_LIMIT = 50;

interface PatientData {
  patient: { patientName: string; lastVisit?: string };
  appointments: AppointmentListResponse;
}

async function loadPatient(id: string): Promise<PatientData | { apiError: ApiError }> {
  try {
    const api = await createServerApi();
    const [patients, appointments] = await Promise.all([
      api.scheduling.getDoctorPatients(),
      // Приёмы этого пациента у текущего врача (9.3): doctorId из sub на сервере
      api.scheduling.getDoctorAppointments({ offset: 0, limit: APPOINTMENTS_LIMIT, patientId: id }),
    ]);
    const patient = patients.items.find((item) => item.patientId === id);
    if (!patient)
      return { apiError: new ApiError('Пациент не найден', { code: 'NOT_FOUND', status: 404 }) };
    return { patient, appointments };
  } catch (error) {
    // NEXT_NOT_FOUND от notFound() и прочие не-API ошибки — наружу без обёртки
    if (!(error instanceof ApiError)) throw error;
    return { apiError: error };
  }
}

/**
 * Карточка пациента врача (9.3, design/doctor-patients.md): приёмы врача
 * с этим пациентом (appointments/doctor + patientId — связь sub → doctorId,
 * 9.1/9.2) и документы; документы защищены проверкой связи на КАЖДЫЙ запрос
 * file-service (потеря связи → 403, AC 9.3).
 */
export default async function DoctorPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await params;
  const result = await loadPatient(id);

  if ('apiError' in result) {
    // 404 — страница пациента вне записей врача (нет связи)
    if (result.apiError.status === 404) notFound();
    return (
      <Alert severity="error" role="alert">
        Не удалось загрузить карточку пациента: {result.apiError.message}
        {result.apiError.requestId ? (
          <Typography variant="caption" sx={{ display: 'block' }}>
            requestId: {result.apiError.requestId}
          </Typography>
        ) : null}
      </Alert>
    );
  }

  const { patient, appointments } = result;

  return (
    <Box>
      <MpPageHeader
        title={patient.patientName}
        subtitle={
          patient.lastVisit
            ? `Последний приём: ${new Date(patient.lastVisit).toLocaleDateString('ru-RU')}`
            : 'Приёмов ещё не было'
        }
        backHref="/doctor/patients"
        backLabel="К списку"
      />

      {/* Приёмы этого пациента у текущего врача (9.3) */}
      <Typography variant="h6" sx={{ mb: 1 }}>
        Приёмы с этим пациентом
      </Typography>
      <Box sx={{ mb: 3 }}>
        <DoctorPatientAppointments initial={appointments} />
      </Box>

      <Typography variant="h6" sx={{ mb: 1 }}>
        Документы
      </Typography>
      <DoctorPatientDocuments patientId={id} />
    </Box>
  );
}
