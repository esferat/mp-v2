import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const specializations = [
  { id: 'sp-1', name: 'Терапевт' },
  { id: 'sp-2', name: 'Кардиолог' },
];

/** Рендер с SSR-данными и справочником фильтров (3.1). */
function renderTable(list: DoctorListResponse = initial): void {
  render(<DoctorsTable initial={list} specializations={specializations} />);
}

/** Открыть MUI-Select и выбрать опцию (MUI рендерит список в портале). */
async function selectOption(label: string, option: string): Promise<void> {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: label }));
  fireEvent.click(await screen.findByRole('option', { name: option }));
}

describe('DoctorsTable (3.1: таблица, поиск без перезагрузки)', () => {
  it('рендерит SSR-данные: врачи, специализации, статусы', () => {
    renderTable();

    expect(screen.getByText('Иванов Имя')).toBeTruthy();
    expect(screen.getByText('Петров Имя')).toBeTruthy();
    expect(screen.getAllByText('Терапевт')).toHaveLength(2);
    // MpStatusBadge (2.7) рендерит русскую лейбу статуса, а не сырой код
    expect(screen.getAllByText('Активен')).toHaveLength(2);
  });

  it('поиск дёргает BFF (shared/api) с debounce, а не перезагружает страницу', async () => {
    getDoctors.mockResolvedValue({ items: [doctor('d-9', 'Сидоров')], total: 1 });

    renderTable();
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

    renderTable();
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

    renderTable();
    fireEvent.change(screen.getByLabelText('Поиск по ФИО'), {
      target: { value: 'x' },
    });

    await waitFor(() => expect(screen.getByText(/req-77/)).toBeTruthy(), { timeout: 2000 });
  });

  it('пустой стартовый список → empty-state с действием (без белого экрана)', () => {
    renderTable({ items: [], total: 0 });
    expect(screen.getByText('Врачей пока нет')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Создать врача' })).toBeTruthy();
  });
});

describe('DoctorsTable (3.1: фильтры «специализация/статус» из макета)', () => {
  it('фильтр специализации уходит в запрос BFF (specId)', async () => {
    getDoctors.mockResolvedValue({ items: [doctor('d-3', 'Кардиологов')], total: 1 });

    renderTable();
    await selectOption('Специализация', 'Кардиолог');

    await waitFor(
      () => expect(getDoctors).toHaveBeenCalledWith(expect.objectContaining({ specId: 'sp-2' })),
      { timeout: 2000 },
    );
    await waitFor(() => expect(screen.getByText('Кардиологов Имя')).toBeTruthy());
  });

  it('фильтр статуса уходит в запрос BFF (status)', async () => {
    getDoctors.mockResolvedValue({ items: [], total: 0 });

    renderTable();
    await selectOption('Статус', 'Архив');

    await waitFor(
      () =>
        expect(getDoctors).toHaveBeenCalledWith(expect.objectContaining({ status: 'INACTIVE' })),
      { timeout: 2000 },
    );
    // пустой отфильтрованный список — не «Врачей пока нет», а «ничего не найдено»
    await waitFor(() => expect(screen.getByText('Ничего не найдено')).toBeTruthy(), {
      timeout: 2000,
    });
  });

  it('без фильтров SSR-страница не перезапрашивается (AC 2.6: без лишних вызовов)', () => {
    renderTable();
    expect(getDoctors).not.toHaveBeenCalled();
  });
});
