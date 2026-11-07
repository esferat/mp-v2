import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Alert, Box, Typography } from '@/shared/ui';
import { ApiError, createServerApi } from '@/shared/api';
import { SpecializationsTable } from '@/widgets/specializations-table';

export const metadata: Metadata = { title: 'Специализации — Администрирование' };

/**
 * Специализации (3.3): SSR-загрузка списка, дальше клиентский остов
 * виджета (создание/удаление без перезагрузки; дубликат → ошибка на поле,
 * занятая → 409 с числом врачей в тосте).
 */
export default async function SpecializationsAdminPage(): Promise<ReactNode> {
  try {
    const api = await createServerApi();
    const items = await api.catalog.getSpecializations();

    return (
      <Box>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Специализации ({items.length})
        </Typography>
        <SpecializationsTable initial={items} />
      </Box>
    );
  } catch (error) {
    const apiError = error instanceof ApiError ? error : null;
    return (
      <Alert severity="error" role="alert">
        Не удалось загрузить специализации: {apiError?.message ?? 'Неизвестная ошибка'}
        {apiError?.requestId ? (
          <Typography variant="caption" sx={{ display: 'block' }}>
            requestId: {apiError.requestId}
          </Typography>
        ) : null}
      </Alert>
    );
  }
}
