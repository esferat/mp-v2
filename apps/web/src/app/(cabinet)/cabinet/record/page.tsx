import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Alert, Box, MpPageHeader, Typography } from '@/shared/ui';
import { ApiError, createServerApi } from '@/shared/api';
import { BookingWizard } from '@/features/booking-wizard';

export const metadata: Metadata = { title: 'Запись на приём — Кабинет' };

/**
 * Запись к врачу (5.2/5.3): специализации грузятся на сервере (SSR),
 * мастер — клиентский остов (запрос слотов и бронь без перезагрузки).
 */
export default async function RecordPage(): Promise<ReactNode> {
  try {
    const api = await createServerApi();
    const specializations = await api.catalog.getSpecializations();

    return (
      <Box>
        <MpPageHeader
          title="Запись к врачу"
          subtitle="Направление и дата → врач и слот → подтверждение"
        />
        <BookingWizard specializations={specializations} />
      </Box>
    );
  } catch (error) {
    const apiError = error instanceof ApiError ? error : null;
    return (
      <Alert severity="error" role="alert">
        Не удалось загрузить направления: {apiError?.message ?? 'Неизвестная ошибка'}
        {apiError?.requestId ? (
          <Typography variant="caption" sx={{ display: 'block' }}>
            requestId: {apiError.requestId}
          </Typography>
        ) : null}
      </Alert>
    );
  }
}
