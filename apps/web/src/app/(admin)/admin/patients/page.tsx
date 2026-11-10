import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Alert, Box, MpPageHeader, Typography } from '@/shared/ui';
import { ApiError, createServerApi } from '@/shared/api';
import { PatientsTable } from '@/widgets/patients-table';

export const metadata: Metadata = { title: 'Пациенты — Администрирование' };

const LIMIT = 10;

/**
 * Список пациентов (4.1): SSR по ?page/search (F5 восстанавливает состояние,
 * AC 2.5), дальше клиентский остов виджета (поиск/пагинация без перезагрузки).
 */
export default async function PatientsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}): Promise<ReactNode> {
  const params = await searchParams;
  const pageValue = Number(params.page ?? '0');
  const offset = Number.isFinite(pageValue) && pageValue > 0 ? Math.floor(pageValue) * LIMIT : 0;
  const search = params.search?.trim() || undefined;

  try {
    const api = await createServerApi();
    const initial = await api.patient.list({
      offset,
      limit: LIMIT,
      ...(search ? { search } : {}),
    });

    return (
      <Box>
        <MpPageHeader title="Пациенты" subtitle={`Всего: ${initial.total}`} />
        <PatientsTable initial={initial} />
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
