import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Box, Container, Typography } from '@/shared/ui';
import { auth } from '@/shared/config/auth';
import { homeRedirectFor } from '@/shared/lib';

/**
 * Главная страница — композиция (fsd.md §3): контент вынесен в виджеты,
 * здесь только сборка. Входящие роли ведут в свой раздел: ADMIN →
 * администрирование, DOCTOR → кабинет врача (9.1 AC); USER остаётся здесь.
 */
export default async function HomePage(): Promise<ReactNode> {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  const landing = homeRedirectFor(roles);
  if (landing) redirect(landing);

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 6 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Медицинский портал
        </Typography>
        <Typography color="text.secondary">
          Запись к врачу, документы и история приёмов. Разделы портала открываются после входа и
          зависят от роли: пациенту — запись и история, врачу — приёмы и пациенты, администратору —
          справочники и управление записями.
        </Typography>
      </Box>
    </Container>
  );
}
