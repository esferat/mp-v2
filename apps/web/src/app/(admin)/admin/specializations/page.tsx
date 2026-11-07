import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Paper, Typography } from '@/shared/ui';

export const metadata: Metadata = { title: 'Специализации — Администрирование' };

/** Страница-заглушка: наполнение — задача 3.3 (CRUD специализаций). */
export default function SpecializationsAdminPage(): ReactNode {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography>CRUD специализаций появится в задаче 3.3.</Typography>
    </Paper>
  );
}
