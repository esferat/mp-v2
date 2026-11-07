import type { ReactNode } from 'react';
import { Box, Container, LinkButton, Paper, Typography } from '@/shared/ui';

/**
 * Глобальная 404 (задача 2.4): неизвестный маршрут → осмысленная страница,
 * а не белый экран (AC 2.4).
 */
export default function NotFound(): ReactNode {
  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h4" component="h1" gutterBottom>
            404 — страница не найдена
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Такой страницы нет или она была перемещена.
          </Typography>
          <LinkButton href="/" variant="contained">
            На главную
          </LinkButton>
        </Paper>
      </Box>
    </Container>
  );
}
