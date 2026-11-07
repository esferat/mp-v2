import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { Alert, Box, Stack, Typography } from '@/shared/ui';
import { ApiError, createServerApi } from '@/shared/api';
import { LinkButton } from '@/shared/ui';
import { DoctorPatientDocuments } from '@/widgets/doctor-patient-documents';

export const metadata: Metadata = { title: 'Документы пациента — Кабинет' };

async function loadPatient(
  id: string,
): Promise<{ patient: { patientName: string; lastVisit?: string } } | { apiError: ApiError }> {
  try {
    const api = await createServerApi();
    const patients = await api.scheduling.getDoctorPatients();
    const patient = patients.items.find((item) => item.patientId === id);
    if (!patient)
      return { apiError: new ApiError('Пациент не найден', { code: 'NOT_FOUND', status: 404 }) };
    return { patient };
  } catch (error) {
    // NEXT_NOT_FOUND от notFound() и прочие не-API ошибки — наружу без обёртки
    if (!(error instanceof ApiError)) throw error;
    return { apiError: error };
  }
}

/**
 * Карточка пациента врача с документами (9.3, design/doctor-patients.md):
 * пациент берётся из ЕГО записей (связь «врач-пациент»), документы защищены
 * проверкой связи на КАЖДЫЙ запрос file-service (потеря связи → 403, AC 9.3).
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
        Не удалось загрузить документы: {result.apiError.message}
        {result.apiError.requestId ? (
          <Typography variant="caption" sx={{ display: 'block' }}>
            requestId: {result.apiError.requestId}
          </Typography>
        ) : null}
      </Alert>
    );
  }

  const { patient } = result;

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ mb: 2, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Box>
          <Typography variant="h6">{patient.patientName}</Typography>
          <Typography variant="caption" color="text.secondary">
            {patient.lastVisit
              ? `Последний приём: ${new Date(patient.lastVisit).toLocaleDateString('ru-RU')}`
              : 'Приёмов ещё не было'}
          </Typography>
        </Box>
        <LinkButton href="/doctor/patients" variant="outlined" color="inherit">
          К списку
        </LinkButton>
      </Stack>

      <Typography variant="h6" sx={{ mb: 1 }}>
        Документы
      </Typography>
      <DoctorPatientDocuments patientId={id} />
    </Box>
  );
}
