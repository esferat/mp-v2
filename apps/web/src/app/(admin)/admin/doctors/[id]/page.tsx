import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import type { DoctorListItem } from '@mp/contracts';
import { Alert, Box, Stack, Typography } from '@/shared/ui';
import { ApiError, createServerApi, loadSpecializations } from '@/shared/api';
import { DoctorForm } from '@/features/doctor-form';
import { DoctorPhoto } from '@/widgets/doctor-photo';

export const metadata: Metadata = { title: 'Врач — Администрирование' };

type LoadResult<T> = { value: T } | { error: string; requestId?: string } | null;

async function loadDoctor(id: string): Promise<LoadResult<DoctorListItem>> {
  try {
    const api = await createServerApi();
    return { value: await api.catalog.getDoctor(id) };
  } catch (error) {
    // 404 — страница not-found (макет: «Врач не найден»)
    if (error instanceof ApiError && error.status === 404) return null;
    if (error instanceof ApiError) {
      return {
        error: error.message,
        ...(error.requestId ? { requestId: error.requestId } : {}),
      };
    }
    return { error: error instanceof Error ? error.message : 'Неизвестная ошибка' };
  }
}

function ErrorAlert({
  result,
}: {
  result: { error: string; requestId?: string };
}): React.JSX.Element {
  return (
    <Alert severity="error" role="alert">
      Не удалось загрузить врача: {result.error}
      {result.requestId ? (
        <Typography variant="caption" sx={{ display: 'block' }}>
          requestId: {result.requestId}
        </Typography>
      ) : null}
    </Alert>
  );
}

/**
 * Страница редактирования врача (3.2): карточка и справочник грузятся
 * на сервере; 404 -> not-found; форма — клиентский остов.
 */
export default async function DoctorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await params;
  const [doctorResult, specializationsResult] = await Promise.all([
    loadDoctor(id),
    loadSpecializations(),
  ]);

  if (doctorResult === null) notFound();

  if ('error' in doctorResult) return <ErrorAlert result={doctorResult} />;
  if ('error' in specializationsResult) return <ErrorAlert result={specializationsResult} />;

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {`${doctorResult.value.lastName} ${doctorResult.value.firstName}${
          doctorResult.value.middleName ? ` ${doctorResult.value.middleName}` : ''
        }`}
      </Typography>
      {/* Двухколоночный макет (design/doctor-form.md): фото + форма */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={3}
        sx={{ alignItems: { xs: 'center', sm: 'flex-start' } }}
      >
        <DoctorPhoto doctor={doctorResult.value} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <DoctorForm
            mode="edit"
            initial={doctorResult.value}
            specializations={specializationsResult.items}
          />
        </Box>
      </Stack>
    </Box>
  );
}
