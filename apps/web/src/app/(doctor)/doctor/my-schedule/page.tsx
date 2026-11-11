import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Alert, Box, MpPageHeader, Typography } from '@/shared/ui';
import { ApiError, createServerApi } from '@/shared/api';
import { auth } from '@/shared/config/auth';
import { ScheduleForm } from '@/features/schedule-form';

export const metadata: Metadata = { title: 'Моё расписание — Кабинет врача' };

/**
 * Моё расписание (10.4, Этап 2.1): врач видит и меняет рабочий период,
 * длительность приёма и рабочие дни своей карточки. Карточка резолвится
 * по sub из токена (GET /api/catalog/doctors/me), правка — PUT …/me/schedule;
 * событие doctor.updated.v1 обновляет копию расписания в scheduling (5.1).
 */
export default async function MySchedulePage(): Promise<ReactNode> {
  try {
    const session = await auth();
    if (!session?.user.id) {
      return <Alert severity="warning">Сессия не найдена — войдите заново.</Alert>;
    }

    const api = await createServerApi();
    const doctor = await api.catalog.getMyDoctor();

    return (
      <Box sx={{ maxWidth: 760 }}>
        <MpPageHeader
          title="Моё расписание"
          subtitle={`${doctor.lastName} ${doctor.firstName} · ${doctor.specializationName}`}
        />
        <ScheduleForm initial={doctor.schedule} />
      </Box>
    );
  } catch (error) {
    // Не-API ошибки (в т.ч. NEXT_REDIRECT «на вход» после неудачного
    // refresh токена) — наружу: catch не должен поглощать редирект
    if (!(error instanceof ApiError)) throw error;
    const apiError = error;
    if (apiError?.status === 404) {
      return (
        <Alert severity="warning">
          К вашей учётной записи не привязана карточка врача — обратитесь к администратору.
        </Alert>
      );
    }
    return (
      <Alert severity="error" role="alert">
        Не удалось загрузить расписание: {apiError?.message ?? 'Неизвестная ошибка'}
        {apiError?.requestId ? (
          <Typography variant="caption" sx={{ display: 'block' }}>
            requestId: {apiError.requestId}
          </Typography>
        ) : null}
      </Alert>
    );
  }
}
