import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DoctorListItem } from '@mp/contracts';
import { DoctorForm } from '../src/features/doctor-form';
import { ToastProvider } from '../src/shared/ui';
import { ApiError } from '../src/shared/api/errors';

const push = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => '/admin/doctors',
  useSearchParams: () => new URLSearchParams(),
}));

const createDoctor = vi.fn();
const updateDoctor = vi.fn();
const updateUserProfile = vi.fn();

// Клиентский API подменяется: форма ходит только через shared/api (2.3)
vi.mock('../src/shared/api/browser', () => ({
  browserApiClient: {},
  browserApi: {
    catalog: {
      createDoctor: (body: unknown) => createDoctor(body),
      updateDoctor: (id: string, body: unknown) => updateDoctor(id, body),
    },
    identity: {
      updateUserProfile: (id: string, body: unknown) => updateUserProfile(id, body),
    },
  },
}));

afterEach(() => {
  cleanup();
  createDoctor.mockReset();
  updateDoctor.mockReset();
  updateUserProfile.mockReset();
  push.mockReset();
  refresh.mockReset();
});

const specializations = [
  { id: 'sp-1', name: 'Хирург' },
  { id: 'sp-2', name: 'Терапевт' },
];

function renderForm(): void {
  render(
    <ToastProvider>
      <DoctorForm mode="create" specializations={specializations} />
    </ToastProvider>,
  );
}

async function selectSpecialization(): Promise<void> {
  // role=combobox есть и у нативных time-инпутов (ARIA-матпинг) -> по label
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /Специализация/ }));
  fireEvent.click(await screen.findByRole('option', { name: 'Хирург' }));
}

function fillValid(): void {
  fireEvent.change(screen.getByLabelText(/^Фамилия/), { target: { value: 'Иванов' } });
  fireEvent.change(screen.getByLabelText(/^Имя/), { target: { value: 'Иван' } });
}

describe('DoctorForm (3.2: форма врача)', () => {
  it('пустая форма: ошибки на полях, запрос не уходит', async () => {
    renderForm();

    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    expect(await screen.findByText('Укажите фамилию')).toBeTruthy();
    expect(await screen.findByText('Укажите имя')).toBeTruthy();
    expect(await screen.findByText('Выберите специализацию')).toBeTruthy();
    expect(createDoctor).not.toHaveBeenCalled();
  });

  it('невалидное расписание: ошибка на поле и без запроса', async () => {
    renderForm();
    fillValid();
    await selectSpecialization();
    fireEvent.change(screen.getByLabelText(/Начало дня/), { target: { value: '18:00' } });
    fireEvent.change(screen.getByLabelText(/Конец дня/), { target: { value: '09:00' } });

    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    expect(await screen.findByText('Начало рабочего дня должно быть раньше конца')).toBeTruthy();
    expect(createDoctor).not.toHaveBeenCalled();
  });

  it('валидная форма: createDoctor с payload и редирект в список', async () => {
    createDoctor.mockResolvedValue({ id: 'd-1' });
    renderForm();
    fillValid();
    await selectSpecialization();

    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    await waitFor(() => expect(createDoctor).toHaveBeenCalledTimes(1));
    expect(createDoctor).toHaveBeenCalledWith({
      firstName: 'Иван',
      lastName: 'Иванов',
      specializationId: 'sp-1',
      schedule: {
        startTime: '09:00',
        endTime: '18:00',
        durationMinutes: 30,
        workDays: [1, 2, 3, 4, 5],
      },
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/doctors'));
  });

  it('двойной клик по кнопке: ровно один запрос (AC 3.2)', async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    createDoctor.mockImplementation(() => new Promise((resolve) => (resolveRequest = resolve)));
    renderForm();
    fillValid();
    await selectSpecialization();

    const submit = screen.getByRole('button', { name: /Сохранить/ });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(createDoctor).toHaveBeenCalledTimes(1);
    resolveRequest({ id: 'd-1' });
    await waitFor(() => expect(push).toHaveBeenCalled());
  });

  it('ошибка сервера с полем показывается под этим полем', async () => {
    createDoctor.mockRejectedValue(
      new ApiError('Длительность должна делить час без остатка (5, 10, 15, 20 или 30 мин)', {
        code: 'VALIDATION_ERROR',
        status: 400,
        field: 'schedule.durationMinutes',
      }),
    );
    renderForm();
    fillValid();
    await selectSpecialization();

    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    expect(
      await screen.findByText(
        'Длительность должна делить час без остатка (5, 10, 15, 20 или 30 мин)',
      ),
    ).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it('селектор длительности: старт 30, только опции 5/10/15/20/30 (кратно часу)', async () => {
    renderForm();

    const combobox = screen.getByRole('combobox', { name: /Длительность приёма/ });
    // стартовое значение 30 (3.2: toValues)
    expect(combobox.textContent).toContain('30');

    // открываются только допустимые длительности
    fireEvent.mouseDown(combobox);
    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      '5 мин',
      '10 мин',
      '15 мин',
      '20 мин',
      '30 мин',
    ]);

    // выбор опции обновляет значение
    fireEvent.click(options[2]); // 15 мин
    expect(combobox.textContent).toContain('15');
  });
});

// --- Edit-режим: email учётной записи (3.2) --------------------------------

const doctor: DoctorListItem = {
  id: 'd-1',
  userId: 'kc-1',
  firstName: 'Иван',
  lastName: 'Иванов',
  specializationId: 'sp-1',
  specializationName: 'Хирург',
  status: 'ACTIVE',
  schedule: {
    startTime: '09:00',
    endTime: '18:00',
    durationMinutes: 30,
    workDays: [1, 2, 3, 4, 5],
  },
};

function renderEdit(accountEmail: string | null): void {
  render(
    <ToastProvider>
      <DoctorForm
        mode="edit"
        initial={doctor}
        accountEmail={accountEmail}
        specializations={specializations}
      />
    </ToastProvider>,
  );
}

describe('DoctorForm edit: email учётной записи (3.2)', () => {
  it('текущий email показан в поле; смена идёт в identity ДО карточки', async () => {
    updateUserProfile.mockResolvedValue({
      userId: 'kc-1',
      email: 'new@test.mp',
      firstName: 'Иван',
      lastName: 'Иванов',
    });
    updateDoctor.mockResolvedValue({ id: 'd-1' });
    renderEdit('old@test.mp');

    expect((screen.getByLabelText(/^Email/) as HTMLInputElement).value).toBe('old@test.mp');

    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'new@test.mp' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    await waitFor(() =>
      expect(updateUserProfile).toHaveBeenCalledWith('kc-1', { email: 'new@test.mp' }),
    );
    await waitFor(() => expect(updateDoctor).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/doctors'));
  });

  it('email не тронут → identity не вызывается, карточка сохраняется', async () => {
    updateDoctor.mockResolvedValue({ id: 'd-1' });
    renderEdit('old@test.mp');

    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    await waitFor(() => expect(updateDoctor).toHaveBeenCalledTimes(1));
    expect(updateUserProfile).not.toHaveBeenCalled();
  });

  it('некорректный email → ошибка на поле, запросов нет', async () => {
    renderEdit('old@test.mp');

    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'не-почта' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    expect(await screen.findByText('Некорректный email')).toBeTruthy();
    expect(updateUserProfile).not.toHaveBeenCalled();
    expect(updateDoctor).not.toHaveBeenCalled();
  });

  it('занятый email (409 с полем) — под полем, карточка НЕ сохранена', async () => {
    updateUserProfile.mockRejectedValue(
      new ApiError('Email уже зарегистрирован', {
        code: 'CONFLICT',
        status: 409,
        field: 'email',
      }),
    );
    renderEdit('old@test.mp');

    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'taken@test.mp' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    expect(await screen.findByText('Email уже зарегистрирован')).toBeTruthy();
    expect(updateDoctor).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('врач без учётной записи: поля email нет, подсказка вместо него', async () => {
    updateDoctor.mockResolvedValue({ id: 'd-1' });
    renderEdit(null);

    expect(screen.queryByLabelText(/^Email/)).toBeNull();
    expect(screen.getByText('Учётной записи нет — email не задан')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    await waitFor(() => expect(updateDoctor).toHaveBeenCalledTimes(1));
    expect(updateUserProfile).not.toHaveBeenCalled();
  });
});
