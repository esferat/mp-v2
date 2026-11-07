import type { ReactNode } from 'react';
import { Box, Container, Typography } from '@/shared/ui';
import { Sidebar } from './sidebar';

/**
 * Каркас страницы раздела (2.1): заголовок + сайдбар + контент.
 * Route group ((admin)/(cabinet)/(doctor)) оборачивает страницы этим layout'ом.
 * Адаптив: на мобильных сайдбар уходит сверху (базово, см. design/layout.md).
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
