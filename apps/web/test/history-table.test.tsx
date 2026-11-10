import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Appointment, AppointmentListResponse } from '@mp/contracts';
import { ToastProvider } from '../src/shared/ui';
import { HistoryTable } from '../src/widgets/history-table';

// Клиентский API подменяется: таблица ходит только через shared/api (2.3)
const getMyAppointments = vi.fn();
vi.mock('../src/shared/api/browser', () => ({
  browserApiClient: {},
  browserApi: {
    scheduling: { getMyAppointments: (params: unknown) => getMyAppointments(params) },
  },
}));

// Хук пагинации использует next/navigation — изолируем
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/cabinet/history',
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
  getMyAppointments.mockReset();
});

const base = {
  patientId: 'p-1',
  patientName: 'Пациент Пациент',
  doctorId: 'd-1',
  doctorName: 'Иванов Имя',
  specializationName: 'Терапевт',
  slot: { localDate: '2026-11-10', start: '10:00' },
  createdAt: '2026-11-01T10:00:00.000Z',
};

/** Завершённый приём с результатом (5.5 AC: в истории виден read-only). */
const completed: Appointment = {
  ...base,
  id: 'a-done',
  status: 'COMPLETED',
  visitResult: { conclusion: 'Здоров, наблюдение', recommendations: 'Повторный осмотр через год' },
};

/** Приём без результата — показываем прочерк, без кнопки. */
const submitted: Appointment = {
  ...base,
  id: 'a-wait',
  status: 'SUBMITTED',
  slot: { localDate: '2026-11-20', start: '11:30' },
};

const initial: AppointmentListResponse = { items: [completed, submitted], total: 2 };

/** Рендер + ожидание ответа списка (до ответа таблица показывает скелетоны). */
async function renderHistory(items = initial): Promise<void> {
  getMyAppointments.mockResolvedValue(items);
  render(
    <ToastProvider>
      <HistoryTable
        initial={items}
        initialFilters={{}}
        specializations={[{ id: 'sp-1', name: 'Терапевт' }]}
      />
    </ToastProvider>,
  );
  // Заголовок колонки появляется только после ответа (скелетоны → таблица)
  await screen.findByText('Результат приёма');
}

describe('HistoryTable (5.5: результат приёма в истории)', () => {
  it('колонка «Результат приёма»: кнопка у завершённого приёма, прочерк у остальных', async () => {
    await renderHistory();

    expect(screen.getByText('Результат приёма')).toBeTruthy(); // заголовок колонки
    expect(screen.getByText('Посмотреть')).toBeTruthy(); // только у COMPLETED
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('просмотр показывает заключение read-only, без кнопки правки (9.2 AC)', async () => {
    await renderHistory();
    const callsBefore = getMyAppointments.mock.calls.length;

    fireEvent.click(screen.getByText('Посмотреть'));

    // Диалог открылся с данными строки списка (без отдельного запроса);
    // заголовок диалога — heading, чтобы не путать с заголовком колонки
    // Заголовок диалога теперь несёт контекст (дата/время/специализация) —
    // проверяем префикс, чтобы не ломать на уточнении заголовка.
    expect(screen.getByRole('heading', { name: /^Результат приёма/ })).toBeTruthy();
    expect(screen.getByDisplayValue('Здоров, наблюдение')).toBeTruthy();
    expect(screen.getByDisplayValue('Повторный осмотр через год')).toBeTruthy();
    expect(getMyAppointments.mock.calls.length).toBe(callsBefore);

    // Пациент не может править: кнопок редактирования нет, только закрытие
    expect(screen.queryByText('Изправить')).toBeNull();
    expect(screen.queryByText('Сохранить')).toBeNull();
    expect(screen.getByText('Закрыть')).toBeTruthy();
  });

  it('приём без результата — кнопки «Посмотреть» нет', async () => {
    await renderHistory({ items: [submitted], total: 1 });

    expect(screen.queryByText('Посмотреть')).toBeNull();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
