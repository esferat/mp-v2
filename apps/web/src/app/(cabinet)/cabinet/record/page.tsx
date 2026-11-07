import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Paper, Typography } from '@/shared/ui';

export const metadata: Metadata = { title: 'Запись на приём' };

/** Страница-заглушка: мастер записи — задачи 5.2/5.3. */
export default function RecordPage(): ReactNode {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography>Мастер записи появится в задачах 5.2–5.3.</Typography>
    </Paper>
  );
}
