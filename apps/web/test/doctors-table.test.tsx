import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { DoctorListResponse } from '@mp/contracts';
import { DoctorsTable } from '../src/widgets/doctors-table';

// Клиентский API подменяется: таблица ходит только через shared/api (2.3)
const getDoctors = vi.fn();
vi.mock('../src/shared/api/browser', () => ({
  browserApiClient: {},
  browserApi: { catalog: { getDoctors: (params: unknown) => getDoctors(params) } },
}));

// Хук пагинации использует next/navigation — изолируем
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/admin/doctors',
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
  getDoctors.mockReset();
});

const doctor = (id: string, lastName: string) => ({
  id,
  firstName: 'Имя',
  lastName,
  specializationId: 'sp-1',
  specializationName: 'Терапевт',
  status: 'ACTIVE' as const,
  schedule: {
    startTime: '09:00',
    endTime: '17:00',
    durationMinutes: 30,
    workDays: [1, 2, 3, 4, 5],
  },
});

const initial: DoctorListResponse = {
  items: [doctor('d-1', 'Иванов'), doctor('d-2', 'Петров')],
  total: 2,
};

describe('DoctorsTable (3.1: таблица, поиск без перезагрузки)', () => {
  it('рендерит SSR-данные: врачи, специализации, статусы', () => {
    render(<DoctorsTable initial={initial} />);

    expect(screen.getByText('Иванов Имя')).toBeTruthy();
    expect(screen.getByText('Петров Имя')).toBeTruthy();
    expect(screen.getAllByText('Терапевт')).toHaveLength(2);
    expect(screen.getAllByText('ACTIVE')).toHaveLength(2);
  });

  it('поиск дёргает BFF (shared/api) с debounce, а не перезагружает страницу', async () => {
    getDoctors.mockResolvedValue({ items: [doctor('d-9', 'Сидоров')], total: 1 });

    render(<DoctorsTable initial={initial} />);
    fireEvent.change(screen.getByLabelText('Поиск по ФИО'), {
      target: { value: 'сидоров' },
    });

    await waitFor(() => expect(getDoctors).toHaveBeenCalled(), { timeout: 2000 });
    expect(getDoctors).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'сидоров', offset: 0, limit: 10 }),
    );

    await waitFor(() => expect(screen.getByText('Сидоров Имя')).toBeTruthy());
  });

  it('пустой результат поиска → empty-state «Ничего не найдено»', async () => {
    getDoctors.mockResolvedValue({ items: [], total: 0 });

    render(<DoctorsTable initial={initial} />);
    fireEvent.change(screen.getByLabelText('Поиск по ФИО'), {
      target: { value: 'никого' },
    });

    await waitFor(() => expect(screen.getByText('Ничего не найдено')).toBeTruthy(), {
      timeout: 2000,
    });
  });

  it('ошибка BFF показывает requestId (AC 2.3/3.1)', async () => {
    const { ApiError } = await import('../src/shared/api/errors');
    getDoctors.mockRejectedValue(
      new ApiError('Сервис недоступен', { code: 'BAD_GATEWAY', status: 502, requestId: 'req-77' }),
    );

    render(<DoctorsTable initial={initial} />);
    fireEvent.change(screen.getByLabelText('Поиск по ФИО'), {
      target: { value: 'x' },
    });

    await waitFor(() => expect(screen.getByText(/req-77/)).toBeTruthy(), { timeout: 2000 });
  });

  it('пустой стартовый список → empty-state с действием (без белого экрана)', () => {
    render(<DoctorsTable initial={{ items: [], total: 0 }} />);
    expect(screen.getByText('Врачей пока нет')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Создать врача' })).toBeTruthy();
  });
});
