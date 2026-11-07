import type { ReactNode } from 'react';
import { Box, Container, LinkButton, Paper, Stack, Typography } from '@/shared/ui';
import { SignInButton } from '@/features/signin';

/**
 * Страница регистрации (1.1): текущий MVP — вход/регистрация через Keycloak
 * (реалм с включённой регистрацией, 0.4). Форма саги (1.4) подключается
 * из BFF — задача 2.6.
 */
export default function SignupPage(): ReactNode {
  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 8 }}>
        <Paper sx={{ p: 4 }}>
          <Typography variant="h5" component="h1" gutterBottom>
            Регистрация
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Создание учётной записи происходит в Keycloak (реалм «Медицинский портал»): после
            подтверждения почты вы войдёте в портал.
          </Typography>
          <Stack direction="row" spacing={2}>
            <SignInButton callbackUrl="/">Перейти к регистрации</SignInButton>
            <LinkButton href="/auth/login" color="inherit">
              У меня есть аккаунт
            </LinkButton>
          </Stack>
        </Paper>
      </Box>
    </Container>
  );
}
