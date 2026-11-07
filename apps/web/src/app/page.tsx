import type { ReactNode } from 'react';
import { Box, Container, Typography } from '@/shared/ui';

/**
 * Главная страница — композиция (fsd.md §3): контент вынесен в виджеты,
 * здесь только сборка. Наполнение — задачи 2.x.
 */
export default function HomePage(): ReactNode {
  return (
    <Container maxWidth="md">
      <Box sx={{ py: 6 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Медицинский портал
        </Typography>
        <Typography color="text.secondary">
          Запись к врачу, документы и история приёмов. Разделы появятся в задачах эпиков 2–5.
        </Typography>
      </Box>
    </Container>
  );
}
