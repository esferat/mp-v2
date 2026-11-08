import type { ReactNode } from 'react';
import { Box, Container, Typography, theme } from '@/shared/ui';
import { Sidebar } from './sidebar';

/**
 * Каркас страницы раздела (2.1): заголовок + сайдбар + контент.
 * Route group ((admin)/(cabinet)/(doctor)) оборачивает страницы этим layout'ом.
 * Адаптив: на мобильных сайдбар уходит сверху (базово, см. design/layout.md).
 *
 * NB: sx в Server Components — только объект (функцию Next не пропустит
 * через RSC-границу в клиентский MUI-компонент): градиент акцентной полосы
 * берётся строкой из импорта theme.
 */
export async function SectionLayout({
  section,
  title,
  description,
  children,
}: {
  section: '/admin' | '/cabinet' | '/doctor';
  title: string;
  description?: string;
  children: ReactNode;
}): Promise<React.JSX.Element> {
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {title}
        </Typography>
        {/* Акцентная полоса под заголовком — градиент бренда (токен темы) */}
        <Box
          sx={{
            width: 72,
            height: 4,
            borderRadius: 2,
            backgroundImage: theme.gradients.brand,
            mb: description ? 1.5 : 0,
          }}
        />
        {description ? <Typography color="text.secondary">{description}</Typography> : null}
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 3,
          alignItems: 'flex-start',
        }}
      >
        <Sidebar section={section} title={title} />
        <Box sx={{ flexGrow: 1, width: '100%' }}>{children}</Box>
      </Box>
    </Container>
  );
}
