import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Paper, Typography } from '@/shared/ui';

export const metadata: Metadata = { title: 'Пациенты — Администрирование' };

/** Страница-заглушка: наполнение — эпик 4 (карточки пациентов). */
export default function PatientsAdminPage(): ReactNode {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography>Список пациентов появится в эпике 4.</Typography>
    </Paper>
  );
}
