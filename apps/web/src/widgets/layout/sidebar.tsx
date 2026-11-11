import { Box, Divider, Paper, Typography } from '@/shared/ui';
import { auth } from '@/shared/config/auth';
import { menuForSection, type MenuRole } from '@/shared/config';
import { MenuList } from './menu-list';

/**
 * Сайдбар раздела (2.1): серверный компонент — пункты фильтруются
 * по ролям сессии на сервере (пункт чужой роли не попадает в HTML).
 */
export async function Sidebar({
  section,
  title,
}: {
  section: '/admin' | '/patient' | '/doctor';
  title: string;
}): Promise<React.JSX.Element> {
  const session = await auth();
  const roles = (session?.user.roles ?? []) as MenuRole[];
  const items = menuForSection(roles, section);

  return (
    <Paper
      component="nav"
      aria-label="Разделы"
      sx={{ p: 1, width: { xs: 'auto', md: 260 }, flexShrink: 0 }}
    >
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {title}
        </Typography>
      </Box>
      <Divider />
      <MenuList items={items} />
    </Paper>
  );
}
