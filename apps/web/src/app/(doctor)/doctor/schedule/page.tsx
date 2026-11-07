import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Paper, Typography } from '@/shared/ui';

export const metadata: Metadata = { title: 'Мои приёмы' };

/** Страница-заглушка: кабинет врача — задача 5.4/5.6 (S4.6). */
export default function DoctorSchedulePage(): ReactNode {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography>Список приёмов врача появится в задачах 5.4–5.6.</Typography>
    </Paper>
  );
}
