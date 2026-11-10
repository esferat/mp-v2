import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Alert, Box, MpPageHeader, Typography } from '@/shared/ui';
import { loadSpecializations } from '@/shared/api';
import { DoctorForm } from '@/features/doctor-form';

export const metadata: Metadata = { title: 'Новый врач — Администрирование' };

/**
 * Страница создания врача (3.2): справочник грузится на сервере (SSR),
 * форма — клиентский остов (валидация и submit без перезагрузки).
 */
export default async function NewDoctorPage(): Promise<ReactNode> {
  const result = await loadSpecializations();

  if ('error' in result) {
    return (
      <Alert severity="error" role="alert">
        Не удалось загрузить специализации: {result.error}
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
      <MpPageHeader title="Новый врач" backHref="/admin/doctors" backLabel="Врачи" />
      <DoctorForm mode="create" specializations={result.items} />
    </Box>
  );
}
