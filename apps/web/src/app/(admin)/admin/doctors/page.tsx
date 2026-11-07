import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Alert, Box, Stack, Typography } from '@/shared/ui';
import { ApiError, createServerApi } from '@/shared/api';
import { DoctorsTable } from '@/widgets/doctors-table';
import { DoctorControls } from '@/widgets/doctor-controls';
import type { DoctorListResponse } from '@mp/contracts';

export const metadata: Metadata = { title: 'Врачи — Администрирование' };

/**
 * SSR-страница списка врачей (задачи 2.6 + 3.1): данные запрашиваются
 * НА СЕРВЕРЕ web (createServerApi → gateway с токеном сессии) — HTML уже
 * содержит контент до гидрации, токена в DOM нет (AC 2.6).
 * Дальнейший поиск/пагинация — клиентский остров (без перезагрузки, AC 3.1).
 */
async function loadDoctors(): Promise<
  { list: DoctorListResponse } | { error: string; requestId?: string }
> {
  try {
    const api = await createServerApi();
    const list = await api.catalog.getDoctors({ limit: 10 });
    return { list };
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        error: error.message,
        ...(error.requestId ? { requestId: error.requestId } : {}),
      };
    }
    return { error: error instanceof Error ? error.message : 'Неизвестная ошибка' };
  }
}

export default async function DoctorsAdminPage(): Promise<ReactNode> {
  const result = await loadDoctors();

  if ('error' in result) {
    return (
      <Alert severity="error" role="alert">
        Не удалось загрузить врачей: {result.error}
        {result.requestId ? (
          <Typography variant="caption" sx={{ display: 'block' }}>
            requestId: {result.requestId}
          </Typography>
        ) : null}
      </Alert>
    );
  }

  return (
    <Box>
      <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">Врачи ({result.list.total})</Typography>
        <DoctorControls />
      </Stack>
      <DoctorsTable initial={result.list} />
    </Box>
  );
}
