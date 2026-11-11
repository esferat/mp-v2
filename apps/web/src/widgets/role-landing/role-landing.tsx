import NextLink from 'next/link';
import { Box, Container, Paper, Stack, Typography } from '@/shared/ui';
import { menuForSection, type MenuRole } from '@/shared/config';

/**
 * Лендинг роли после авторизации: обзор доступного функционала карточками —
 * пункты меню роли (MENU_ITEMS, тот же реестр что и сайдбар) + карточка
 * профиля (профиль в боковое меню не входит —10.1, но остаётся доступен
 * из меню пользователя в шапке). Маршрут защищён гардом роли (1.3).
 */
export interface RoleLandingProps {
  /** Секция раздела — из неё собираются пункты (menuForSection). */
  section: '/admin' | '/patient' | '/doctor';
  /** Заголовок лендинга (название раздела). */
  title: string;
  /** Подзаголовок — краткое описание назначения раздела. */
  subtitle: string;
}

/** Роль секции и карточка профиля (role-specific маршрут, profile.md 10.1). */
const SECTION_PROFILE = {
  '/admin': {
    role: 'ADMIN',
    item: { href: '/admin/profile', label: 'Профиль', description: 'Личные данные и смена email' },
  },
  '/patient': {
    role: 'USER',
    item: {
      href: '/patient/profile',
      label: 'Профиль',
      description: 'Данные пациента, фото и сканы документов',
    },
  },
  '/doctor': {
    role: 'DOCTOR',
    item: { href: '/doctor/profile', label: 'Профиль', description: 'Личные данные и смена email' },
  },
} as const satisfies Record<
  '/admin' | '/patient' | '/doctor',
  { role: MenuRole; item: { href: string; label: string; description: string } }
>;

export function RoleLanding({ section, title, subtitle }: RoleLandingProps): React.JSX.Element {
  const { role, item: profile } = SECTION_PROFILE[section];
  const items = [...menuForSection([role], section), profile];

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {subtitle}
        </Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          useFlexGap
          sx={{ flexWrap: 'wrap' }}
        >
          {items.map((entry) => (
            <NextLink
              key={entry.href}
              href={entry.href}
              style={{ textDecoration: 'none', color: 'inherit', flex: '1 1 240px' }}
            >
              <Paper
                elevation={1}
                sx={{
                  height: '100%',
                  p: 2.5,
                  borderTop: 4,
                  borderColor: 'primary.main',
                  transition: 'transform 0.15s ease',
                  '&:hover': { transform: 'translateY(-2px)' },
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {entry.label}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {entry.description}
                </Typography>
              </Paper>
            </NextLink>
          ))}
        </Stack>
      </Box>
    </Container>
  );
}
