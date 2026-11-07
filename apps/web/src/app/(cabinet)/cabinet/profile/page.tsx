import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Paper, Typography } from '@/shared/ui';

export const metadata: Metadata = { title: 'Профиль' };

/** Страница-заглушка: карточка пациента — эпик 4 (S3.2). */
export default function ProfilePage(): ReactNode {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography>Профиль пациента появится в эпике 4.</Typography>
    </Paper>
  );
}
