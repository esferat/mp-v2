import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Box, Container, LinkButton, Paper, Stack, theme, Typography } from '@/shared/ui';
import { Header } from '@/widgets/layout';
import { auth } from '@/shared/config/auth';
import { homeRedirectFor } from '@/shared/lib';

/**
 * Главная страница — композиция (fsd.md §3): контент вынесен в виджеты,
 * здесь только сборка. Входящие роли ведут в свой раздел: ADMIN →
 * администрирование, DOCTOR → кабинет врача (9.1 AC), USER → личный
 * кабинет (1.4: с боковым меню и профилем). Для гостя это агрегированный
 * лендинг с кнопками входа/регистрации.
 *
 * Визуал: герой на фирменном градиенте (токен темы gradients.brand) +
 * карточки направлений портала с цветными акцентами из палитры темы.
 * NB: в Server Components sx — только объект: функцию sx Next не пропустит
 * через RSC-границу в клиентский MUI-компонент (ошибка «Functions cannot
 * be passed directly»), поэтому градиент берём из импорта theme строкой.
 */

interface Feature {
  title: string;
  description: string;
  /** Токен цвета акцента из палитры темы (без «сырых» цветов). */
  accent: 'primary' | 'secondary' | 'warning';
}

const FEATURES: Feature[] = [
  {
    title: 'Пациенту',
    description: 'Запись к врачу, документы и история приёмов — всё в личном кабинете.',
    accent: 'primary',
  },
  {
    title: 'Врачу',
    description: 'Приёмы, результаты приёма и документы пациентов в одном месте.',
    accent: 'secondary',
  },
  {
    title: 'Администратору',
    description: 'Справочники врачей и специализаций, управление записями и отчёты.',
    accent: 'warning',
  },
];

export default async function HomePage(): Promise<ReactNode> {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  const landing = homeRedirectFor(roles);
  if (landing) redirect(landing);

  return (
    <>
      <Header />
      <Container maxWidth="md">
        <Box sx={{ py: 6 }}>
          {/* Герой: фирменный градиент вместо плоского заголовка */}
          <Box
            sx={{
              p: 4,
              mb: 3,
              borderRadius: 2,
              backgroundImage: theme.gradients.brand,
              color: 'common.white',
              boxShadow: 3,
            }}
          >
            <Typography variant="h4" component="h1" gutterBottom>
              Медицинский портал
            </Typography>
            <Typography>
              Запись к врачу, документы и история приёмов. Разделы портала открываются после входа и
              зависят от роли.
            </Typography>
            {!session ? (
              <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                <LinkButton
                  href="/auth/login"
                  variant="contained"
                  sx={{
                    bgcolor: 'common.white',
                    color: 'primary.dark',
                    '&:hover': { bgcolor: 'grey.100' },
                  }}
                >
                  Войти
                </LinkButton>
                <LinkButton
                  href="/auth/register"
                  variant="outlined"
                  sx={{ borderColor: 'common.white', color: 'common.white' }}
                >
                  Регистрация
                </LinkButton>
              </Stack>
            ) : null}
          </Box>

          {/* Карточки направлений: цветной акцент слева из палитры темы */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            {FEATURES.map((feature) => (
              <Paper
                key={feature.title}
                elevation={1}
                sx={{
                  flex: 1,
                  p: 2.5,
                  borderTop: 4,
                  // цвет акцента — токен палитры темы ('primary' | 'secondary' | 'warning')
                  borderColor: `${feature.accent}.main`,
                  transition: 'transform 0.15s ease',
                  '&:hover': { transform: 'translateY(-2px)' },
                  // цветной «подсвет» заголовка — токен палитры темы
                  '& .feature-title': { color: `${feature.accent}.dark` },
                }}
              >
                <Typography variant="subtitle1" className="feature-title" sx={{ fontWeight: 700 }}>
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {feature.description}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </Box>
      </Container>
    </>
  );
}
