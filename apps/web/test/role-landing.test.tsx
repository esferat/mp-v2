import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleLanding } from '../src/widgets/role-landing';
import { MENU_ITEMS, menuForSection } from '../src/shared/config/menu';

// NextLink читает pathname через next/navigation — подменяем для изоляции
vi.mock('next/navigation', () => ({
  usePathname: () => '/patient',
}));

function linkHrefs(): (string | null)[] {
  return [...screen.getAllByRole('link')].map((a) => a.getAttribute('href'));
}

describe('RoleLanding (лендинг роли после входа)', () => {
  it('пациент: карточки разделов + профиль, все со ссылками и описанием', () => {
    render(
      <RoleLanding section="/patient" title="Кабинет пациента" subtitle="Обзор функционала" />,
    );

    expect(screen.getByText('Кабинет пациента')).toBeTruthy();
    expect(screen.getByText('Обзор функционала')).toBeTruthy();

    expect(linkHrefs()).toEqual([
      '/patient/record',
      '/patient/history',
      '/patient/documents',
      '/patient/profile',
    ]);
    // описание раздела — под заголовком карточки
    expect(screen.getByText(/Мастер записи/)).toBeTruthy();
    expect(screen.getByText(/Данные пациента/)).toBeTruthy();
  });

  it('админ: все пункты администрирования + профиль', () => {
    render(<RoleLanding section="/admin" title="Администрирование" subtitle="x" />);

    expect(linkHrefs()).toEqual([
      '/admin/doctors',
      '/admin/specializations',
      '/admin/patients',
      '/admin/schedule',
      '/admin/reports',
      '/admin/profile',
    ]);
  });

  it('врач: кабинет врача + профиль', () => {
    render(<RoleLanding section="/doctor" title="Кабинет врача" subtitle="x" />);

    expect(linkHrefs()).toEqual([
      '/doctor/schedule',
      '/doctor/my-schedule',
      '/doctor/patients',
      '/doctor/profile',
    ]);
  });

  it('каждый пункт меню имеет описание — карточка лендинга не пустая', () => {
    expect(MENU_ITEMS.length).toBeGreaterThan(0);
    expect(MENU_ITEMS.every((item) => item.description.trim().length > 0)).toBe(true);
  });

  it('пункты лендинга = пункты бокового меню секции (без дублирования реестра)', () => {
    expect(menuForSection(['USER'], '/patient').map((i) => i.href)).toEqual([
      '/patient/record',
      '/patient/history',
      '/patient/documents',
    ]);
  });
});
