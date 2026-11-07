import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { appointmentStatusSchema, type AppointmentListQuery } from '@mp/contracts';
import { Alert, Box, Stack, Typography } from '@/shared/ui';
import { ApiError, createServerApi } from '@/shared/api';
import { periodRange } from '@/shared/lib';
import { DoctorAppointmentsTable } from '@/widgets/doctor-appointments-table';

export const metadata: Metadata = { title: 'Мои приёмы — Кабинет врача' };

const LIMIT = 10;

/**
 * Приёмы врача (9.2): SSR по ?page/status/period (F5 восстанавливает
 * фильтры, AC 2.5). doctorId сервер берёт из привязки sub — врач видит
 * только СВОИ записи (AC 9.2).
 */
export default async function DoctorSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; period?: string }>;
}): Promise<ReactNode> {
  const params = await searchParams;

  const pageValue = Number(params.page ?? '0');
  const offset = Number.isFinite(pageValue) && pageValue > 0 ? Math.floor(pageValue) * LIMIT : 0;
  const parsedStatus = params.status ? appointmentStatusSchema.safeParse(params.status) : null;
  const filters = {
    ...(parsedStatus?.success ? { status: parsedStatus.data } : {}),
    period: params.period === 'today' || params.period === 'week' ? params.period : 'all',
  };
  const range = periodRange(filters.period);

  try {
    const api = await createServerApi();
    const initial = await api.scheduling.getDoctorAppointments({
      offset,
      limit: LIMIT,
      ...(filters.status ? { status: filters.status } : {}),
      ...(range.from ? { from: range.from } : {}),
      ...(range.to ? { to: range.to } : {}),
    } satisfies AppointmentListQuery);

    return (
      <Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ mb: 2, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
        >
          <Typography variant="h6">Мои приёмы ({initial.total})</Typography>
        </Stack>
        <DoctorAppointmentsTable initial={initial} initialFilters={filters} />
      </Box>
    );
  } catch (error) {
    const apiError = error instanceof ApiError ? error : null;
    return (
      <Alert severity="error" role="alert">
        Не удалось загрузить приёмы: {apiError?.message ?? 'Неизвестная ошибка'}
        {apiError?.requestId ? (
          <Typography variant="caption" sx={{ display: 'block' }}>
            requestId: {apiError.requestId}
          </Typography>
        ) : null}
      </Alert>
    );
  }
}
