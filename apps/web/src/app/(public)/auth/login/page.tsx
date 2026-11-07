import type { ReactNode } from 'react';
import { Box, Container, LinkButton, Paper, Stack, Typography } from '@/shared/ui';
import { SignInButton } from '@/features/signin';

/**
 * Страница входа (1.1): композиция без бизнес-логики (fsd.md §3).
 * Вход — POST-flow Auth.js (SignInButton): сначала CSRF, затем редирект
 * в Keycloak; отказ/отмена возвращает сюда же (callbackUrl).
 */
export default function LoginPage(): ReactNode {
  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 8 }}>
        <Paper sx={{ p: 4 }}>
          <Typography variant="h5" component="h1" gutterBottom>
            Вход в портал
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Войдите через учётную запись портала (Keycloak). Нет аккаунта — зарегистрируйтесь.
          </Typography>
          <Stack direction="row" spacing={2}>
            <SignInButton callbackUrl="/">Войти</SignInButton>
            <LinkButton href="/auth/signup" color="inherit">
              Регистрация
            </LinkButton>
          </Stack>
        </Paper>
      </Box>
    </Container>
  );
}
