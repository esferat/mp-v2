import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Paper, Typography } from '@/shared/ui';

export const metadata: Metadata = { title: 'Пациенты врача' };

/** Страница-заглушка: пациенты врача — задача S4.6/S3.7. */
export default function DoctorPatientsPage(): ReactNode {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography>Пациенты врача появятся в задачах 5.4/3.7.</Typography>
    </Paper>
  );
}
