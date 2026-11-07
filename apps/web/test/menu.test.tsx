import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MENU_ITEMS, menuForRoles, menuForSection } from '../src/shared/config/menu';
import { MenuList } from '../src/widgets/layout/menu-list';

// MenuList читает pathname через next/navigation — подменяем для изоляции
vi.mock('next/navigation', () => ({
  usePathname: () => '/cabinet/record',
}));

describe('menuForRoles (2.1: пункт недоступной роли не рендерится)', () => {
  it('ADMIN видит только администрирование', () => {
    const items = menuForRoles(['ADMIN']);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.href.startsWith('/admin/'))).toBe(true);
    expect(items.map((i) => i.href)).not.toContain('/cabinet/record');
  });

  it('USER видит только личный кабинет', () => {
    const items = menuForRoles(['USER']);
    expect(items.every((item) => item.href.startsWith('/cabinet/'))).toBe(true);
    expect(items.map((i) => i.href)).not.toContain('/admin/doctors');
  });

  it('DOCTOR видит только кабинет врача', () => {
    const items = menuForRoles(['DOCTOR']);
    expect(items.every((item) => item.href.startsWith('/doctor/'))).toBe(true);
  });

  it('без ролей — пустое меню (гость не видит разделов)', () => {
    expect(menuForRoles([])).toEqual([]);
  });

  it('ADMIN без /admin-пунктов не получает чужих (меню не «склеивается»)', () => {
    const admin = menuForRoles(['ADMIN']);
    const doctor = menuForRoles(['DOCTOR']);
    expect(admin.some((i) => doctor.includes(i))).toBe(false);
  });
});

describe('menuForSection', () => {
  it('фильтрует по разделу пути', () => {
    expect(menuForSection(['ADMIN', 'USER'], '/admin').length).toBe(
      MENU_ITEMS.filter((i) => i.href.startsWith('/admin')).length,
    );
    expect(menuForSection(['USER'], '/admin')).toEqual([]);
  });
});

describe('MenuList (рендер)', () => {
  it('отрисовывает пункты и подсвечивает активный', () => {
    render(<MenuList items={menuForRoles(['USER'])} />);

    expect(screen.getByText('Запись на приём')).toBeTruthy();
    expect(screen.getByText('История приёмов')).toBeTruthy();

    // Подсветка активного — класс Mui-selected на корне пункта
    // (aria-selected MUI ставит только для роли button, у ссылок его нет)
    const active = screen.getByText('Запись на приём').closest('.MuiListItemButton-root');
    expect(active?.className).toContain('Mui-selected');

    const inactive = screen.getByText('История приёмов').closest('.MuiListItemButton-root');
    expect(inactive?.className).not.toContain('Mui-selected');
  });

  it('пустое меню → понятное состояние, а не белый экран', () => {
    render(<MenuList items={[]} />);
    expect(screen.getByText('Нет доступных разделов')).toBeTruthy();
  });

  it('чужие пункты не попадают в DOM (AC 2.1)', () => {
    render(<MenuList items={menuForRoles(['USER'])} />);
    expect(screen.queryByText('Врачи')).toBeNull();
    expect(screen.queryByText('Мои приёмы')).toBeNull();
  });
});
