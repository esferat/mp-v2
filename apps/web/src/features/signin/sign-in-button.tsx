'use client';

import type { ButtonProps } from '@/shared/ui';
import { Button } from '@/shared/ui';
import { signIn } from 'next-auth/react';

/**
 * Кнопка входа (задача 1.1): клиентский signIn из next-auth/react выполняет
 * POST /api/auth/signin/keycloak с CSRF-токеном — единственный рабочий flow
 * в Auth.js beta (GET signin/[provider] не поддерживается @auth/core 0.41).
 * Отказ/отмена в Keycloak возвращает на callbackUrl (1.1 AC).
 *
 * `sx` пробрасывается, чтобы кнопка могла менять вид под контекст
 * (например, белая на градиентной шапке) — токены темы, без сырых цветов.
 */
export function SignInButton({
  callbackUrl = '/',
  variant = 'contained',
  size = 'medium',
  sx,
  children = 'Войти',
}: {
  callbackUrl?: string;
  variant?: 'contained' | 'outlined' | 'text';
  size?: 'small' | 'medium' | 'large';
  sx?: ButtonProps['sx'];
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <Button
      variant={variant}
      size={size}
      sx={sx}
      onClick={() => {
        void signIn('keycloak', { callbackUrl });
      }}
    >
      {children}
    </Button>
  );
}
