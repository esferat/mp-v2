import { AppBar, Box, Button, Chip, Container, LinkButton, Toolbar } from '@/shared/ui';
import { auth } from '@/shared/config/auth';
import { SignInButton, signOutAction } from '@/features/signin';

/**
 * Шапка приложения (widgets/layout): серверный компонент — читает сессию
 * на сервере, токен в DOM не попадает (AC 1.1). Пункты меню по ролям —
 * вторичный слой защиты (основная — гарды 1.3).
 *
 * Ссылки — через LinkButton (next/link): мягкая навигация вместо полной
 * перезагрузки страницы. Обёртка клиентская, потому что в Server Components
 * нельзя передавать функцию-компонент в MUI Button (ошибка RSC).
 */
export async function Header(): Promise<React.JSX.Element> {
  const session = await auth();
  const roles = session?.user.roles ?? [];

  return (
    <AppBar position="static" color="transparent" elevation={0}>
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ gap: 2 }}>
          <LinkButton
            href="/"
            sx={{
              flexGrow: 1,
              textDecoration: 'none',
              color: 'inherit',
              fontWeight: 700,
              fontSize: '1.1rem',
            }}
          >
            Медицинский портал
          </LinkButton>

          {session ? (
            <>
              {roles.map((role) => (
                <Chip key={role} label={role} size="small" color="primary" variant="outlined" />
              ))}
              <Box component="span" sx={{ color: 'text.secondary' }}>
                {session.user.email}
              </Box>
              <form action={signOutAction}>
                <Button type="submit" variant="outlined" size="small">
                  Выйти
                </Button>
              </form>
            </>
          ) : (
            <>
              <LinkButton href="/auth/signup" size="small" color="inherit">
                Регистрация
              </LinkButton>
              <SignInButton callbackUrl="/" variant="contained" size="small">
                Войти
              </SignInButton>
            </>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
}
