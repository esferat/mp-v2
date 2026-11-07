import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Paper, Typography } from '@/shared/ui';

export const metadata: Metadata = { title: 'Отчёты — Администрирование' };

/** Страница-заглушка: наполнение — эпик 7 (CQRS-отчёты). */
export default function ReportsAdminPage(): ReactNode {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography>Отчёты появятся в эпике 7.</Typography>
    </Paper>
  );
}
