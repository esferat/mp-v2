import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { AppShell } from '../src/widgets/layout/app-shell';
import { menuForRoles } from '../src/shared/config/menu';
import { theme } from '../src/shared/ui/theme';

// AppShell читает pathname/роутер через next/navigation — изолируем;
// user-menu тянет signOutAction (Auth.js/next/server) — не нужен в этом тесте
vi.mock('next/navigation', () => ({
  usePathname: () => '/patient/record',
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('../src/widgets/layout/user-menu', () => ({
  UserMenu: () => null,
}));

const LOGO_LABEL = 'Главная страница раздела';

function renderShell(logoHref: string, roles: ('ADMIN' | 'USER' | 'DOCTOR')[]): void {
  // Тема обязательна: useMediaQuery читает theme.breakpoints (как в app root)
  render(
    <ThemeProvider theme={theme}>
      <AppShell items={menuForRoles(roles)} groupTitle="Раздел" logoHref={logoHref}>
        <div>контент</div>
      </AppShell>
    </ThemeProvider>,
  );
}

describe('AppShell: клик по логотипу ведёт на лендинг роли', () => {
  it('пациент: логотип — ссылка на /patient', () => {
    renderShell('/patient', ['USER']);

    const logo = screen.getByRole('link', { name: LOGO_LABEL });
    expect(logo.getAttribute('href')).toBe('/patient');
  });

  it('админ: логотип — ссылка на /admin', () => {
    renderShell('/admin', ['ADMIN']);

    expect(screen.getByRole('link', { name: LOGO_LABEL }).getAttribute('href')).toBe('/admin');
  });

  it('врач: логотип — ссылка на /doctor', () => {
    renderShell('/doctor', ['DOCTOR']);

    expect(screen.getByRole('link', { name: LOGO_LABEL }).getAttribute('href')).toBe('/doctor');
  });
});
