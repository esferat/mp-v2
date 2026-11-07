import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Paper, Typography } from '@/shared/ui';

export const metadata: Metadata = { title: 'История приёмов' };

/** Страница-заглушка: история — задача 5.5. */
export default function HistoryPage(): ReactNode {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography>История приёмов появится в задаче 5.5.</Typography>
    </Paper>
  );
}
