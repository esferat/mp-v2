import type { ReactNode } from 'react';
import { Box, Container, LinkButton, Paper, Typography } from '@/shared/ui';
import { Header } from '@/widgets/layout';

/**
 * Страница 403 (задача 1.3): нет нужной роли. Контент защищённого раздела
 * сюда не попадает — гард перенаправляет сюда ДО рендера страницы.
 */
export default function ForbiddenPage(): ReactNode {
  return (
    <>
      <Header />
      <Container maxWidth="sm">
        <Box sx={{ py: 8 }}>
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h4" component="h1" gutterBottom>
              403 — нет доступа
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              У вашей учётной записи нет роли для этого раздела. Если вы считаете, что это ошибка —
              обратитесь к администратору.
            </Typography>
            <LinkButton href="/" variant="contained">
              На главную
            </LinkButton>
          </Paper>
        </Box>
      </Container>
    </>
  );
}
