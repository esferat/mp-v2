import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SpecializationsTable } from '../src/widgets/specializations-table';
import { ToastProvider } from '../src/shared/ui';
import { ApiError } from '../src/shared/api/errors';

const getSpecializations = vi.fn();
const createSpecialization = vi.fn();
const deleteSpecialization = vi.fn();

// Клиентский API подменяется: виджет ходит только через shared/api (2.3)
vi.mock('../src/shared/api/browser', () => ({
  browserApiClient: {},
  browserApi: {
    catalog: {
      getSpecializations: () => getSpecializations(),
      createSpecialization: (body: unknown) => createSpecialization(body),
      deleteSpecialization: (id: string) => deleteSpecialization(id),
    },
  },
}));

const initial = [
  { id: 'sp-1', name: 'Хирург', doctorsCount: 3 },
  { id: 'sp-2', name: 'Терапевт', doctorsCount: 0 },
];

function renderTable(): void {
  render(
    <ToastProvider>
      <SpecializationsTable initial={initial} />
    </ToastProvider>,
  );
}

beforeEach(() => {
  getSpecializations.mockResolvedValue(initial);
});

afterEach(() => {
  cleanup();
  getSpecializations.mockReset();
  createSpecialization.mockReset();
  deleteSpecialization.mockReset();
});

describe('SpecializationsTable (3.3)', () => {
  it('рендерит список с числом врачей', () => {
    renderTable();
    expect(screen.getByText('Хирург')).toBeTruthy();
    expect(screen.getByText('Терапевт')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('создание: валидное название → запрос и обновление списка', async () => {
    const created = { id: 'sp-3', name: 'Кардиолог', doctorsCount: 0 };
    createSpecialization.mockResolvedValue(created);
    // после создания список включает новую запись (refresh)
    getSpecializations.mockResolvedValue([...initial, created]);
    renderTable();

    fireEvent.click(screen.getByRole('button', { name: /Создать специализацию/ }));
    const input = screen.getByLabelText(/Название/);
    fireEvent.change(input, { target: { value: 'Кардиолог' } });
    fireEvent.click(screen.getByRole('button', { name: /^Создать$/ }));

    await waitFor(() => expect(createSpecialization).toHaveBeenCalledWith({ name: 'Кардиолог' }));
    await waitFor(() => expect(getSpecializations).toHaveBeenCalled());
    expect(await screen.findByText('Кардиолог')).toBeTruthy();
  });

  it('дубликат (409) → ошибка под полем, модалка остаётся открытой', async () => {
    createSpecialization.mockRejectedValue(
      new ApiError('Специализация «ХИРУРГ» уже существует', {
        code: 'CONFLICT',
        status: 409,
      }),
    );
    renderTable();

    fireEvent.click(screen.getByRole('button', { name: /Создать специализацию/ }));
    fireEvent.change(screen.getByLabelText(/Название/), { target: { value: 'хирург' } });
    fireEvent.click(screen.getByRole('button', { name: /^Создать$/ }));

    expect(await screen.findByText('Специализация «ХИРУРГ» уже существует')).toBeTruthy();
    // модалка открыта: поле ввода на месте
    expect(screen.getByLabelText(/Название/)).toBeTruthy();
    expect(getSpecializations).not.toHaveBeenCalled(); // список не перезагрывался
  });

  it('короткое название → клиентская ошибка, запрос не уходит', async () => {
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: /Создать специализацию/ }));
    fireEvent.change(screen.getByLabelText(/Название/), { target: { value: 'A' } });
    fireEvent.click(screen.getByRole('button', { name: /^Создать$/ }));

    expect(await screen.findByText('Название: минимум 2 символа')).toBeTruthy();
    expect(createSpecialization).not.toHaveBeenCalled();
  });

  it('удаление свободной: подтверждение → запрос и обновление', async () => {
    deleteSpecialization.mockResolvedValue({ ok: true });
    renderTable();

    // кнопка удаления у «Терапевт» (doctorsCount = 0)
    const rows = screen.getAllByRole('row');
    const terapevtRow = rows.find((row) => row.textContent?.includes('Терапевт'));
    fireEvent.click(within(terapevtRow!).getByRole('button', { name: 'Удалить' }));

    // подтверждение в диалоге
    const confirm = await screen.findByRole('button', { name: 'Удалить' });
    fireEvent.click(confirm);

    await waitFor(() => expect(deleteSpecialization).toHaveBeenCalledWith('sp-2'));
  });

  it('занятая (409) → тост с сообщением сервера, список перезагружен', async () => {
    deleteSpecialization.mockRejectedValue(
      new ApiError('Нельзя удалить: специализацией пользуются 3 врачей', {
        code: 'CONFLICT',
        status: 409,
      }),
    );
    renderTable();

    const rows = screen.getAllByRole('row');
    const surgicalRow = rows.find((row) => row.textContent?.includes('Хирург'));
    fireEvent.click(within(surgicalRow!).getByRole('button', { name: 'Удалить' }));
    const confirm = await screen.findByRole('button', { name: 'Удалить' });
    fireEvent.click(confirm);

    expect(
      await screen.findByText('Нельзя удалить: специализацией пользуются 3 врачей'),
    ).toBeTruthy();
    await waitFor(() => expect(getSpecializations).toHaveBeenCalled());
  });
});
