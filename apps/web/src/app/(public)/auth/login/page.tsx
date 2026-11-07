import type { ReactNode } from 'react';
import { Box, Container, LinkButton, Paper, Stack, Typography } from '@/shared/ui';
import { SignInButton } from '@/features/signin';

/**
 * Страница входа (1.1): композиция без бизнес-логики (fsd.md §3).
 * Вход — POST-flow Auth.js (SignInButton): сначала CSRF, затем редирект
 * в Keycloak; отказ/отмена возвращает на callbackUrl.
 *
 * callbackUrl берётся из query (так возвращает гард 1.3: /auth/login?callbackUrl=…)
 * и ограничивается относительным путём — open redirect исключён.
 */
function safeCallback(value: string | undefined): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) return value;
  return '/';
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}): Promise<ReactNode> {
  const { callbackUrl } = await searchParams;

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
            <SignInButton callbackUrl={safeCallback(callbackUrl)}>Войти</SignInButton>
            <LinkButton href="/auth/signup" color="inherit">
              Регистрация
            </LinkButton>
          </Stack>
        </Paper>
      </Box>
    </Container>
  );
}
