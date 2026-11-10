import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Alert, Box, LinkButton, MpPageHeader, Typography } from '@/shared/ui';
import { ApiError, createServerApi } from '@/shared/api';
import { DoctorPatientsTable } from '@/widgets/doctor-patients-table';

export const metadata: Metadata = { title: 'Пациенты врача — Кабинет' };

/**
 * Пациенты врача (9.3): distinct из ЕГО записей (doctorId — из привязки
 * sub, AC 9.2/9.3), список отдаётся целиком — поиск клиентский.
 */
export default async function DoctorPatientsPage(): Promise<ReactNode> {
  try {
    const api = await createServerApi();
    const initial = await api.scheduling.getDoctorPatients();

    return (
      <Box>
        <MpPageHeader
          title="Пациенты и документы"
          subtitle={`Всего: пациентов ${initial.total}`}
          actions={
            <LinkButton href="/doctor/schedule" variant="outlined" color="inherit">
              ← К приёмам
            </LinkButton>
          }
        />
        <DoctorPatientsTable initial={initial} />
      </Box>
    );
  } catch (error) {
    const apiError = error instanceof ApiError ? error : null;
    return (
      <Alert severity="error" role="alert">
        Не удалось загрузить пациентов: {apiError?.message ?? 'Неизвестная ошибка'}
        {apiError?.requestId ? (
          <Typography variant="caption" sx={{ display: 'block' }}>
            requestId: {apiError.requestId}
          </Typography>
        ) : null}
      </Alert>
    );
  }
}
