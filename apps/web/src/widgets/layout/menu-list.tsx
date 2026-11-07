'use client';

import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { List, ListItemButton, ListItemText } from '@/shared/ui';
import type { MenuItem } from '@/shared/config';

/**
 * Список пунктов меню (клиентский остров): подсветка активного пункта.
 * Сами пункты уже отфильтрованы по ролям на сервере (2.1).
 * Навигация — next/link (мягкая, без полной перезагрузки страницы).
 */
export function MenuList({ items }: { items: MenuItem[] }): React.JSX.Element {
  const pathname = usePathname();

  if (items.length === 0) {
    return (
      <List disablePadding>
        <ListItemButton disabled>
          <ListItemText primary="Нет доступных разделов" />
        </ListItemButton>
      </List>
    );
  }

  return (
    <List disablePadding>
      {items.map((item) => (
        <ListItemButton
          key={item.href}
          href={item.href}
          component={NextLink}
          selected={pathname === item.href || pathname.startsWith(`${item.href}/`)}
        >
          <ListItemText primary={item.label} />
        </ListItemButton>
      ))}
    </List>
  );
}
