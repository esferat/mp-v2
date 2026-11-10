import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import {
  DataTable,
  EmptyState,
  FormField,
  StatusBadge,
  ToastProvider,
  useToast,
} from '../src/shared/ui';

describe('StatusBadge (2.2: бейдж статуса)', () => {
  it('рендерит текст и точку-индикатор (2.2: «точка + цветной текст»)', () => {
    const { container } = render(<StatusBadge label="APPROVED" tone="success" />);
    expect(screen.getByText('APPROVED')).toBeTruthy();
    expect(container.querySelector('.StatusBadge-dot')).toBeTruthy();
  });

  it('по умолчанию нейтральный тон: label рендерится, точка на месте', () => {
    const { container } = render(<StatusBadge label="SUBMITTED" />);
    expect(screen.getByText('SUBMITTED')).toBeTruthy();
    expect(container.querySelector('.StatusBadge-dot')).toBeTruthy();
  });
});

describe('EmptyState (2.2: пустое состояние)', () => {
  it('показывает заголовок, описание и действие', () => {
    render(
      <EmptyState
        title="Нет врачей"
        description="Создайте первого врача"
        actionLabel="Создать"
        actionHref="/admin/doctors/new"
      />,
    );
    expect(screen.getByText('Нет врачей')).toBeTruthy();
    expect(screen.getByText('Создайте первого врача')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Создать' })).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
  });
});

describe('DataTable (2.2: состояния таблицы)', () => {
  interface Row {
    id: string;
    name: string;
  }

  const columns = [{ key: 'name', header: 'Имя' }];
  const rows: Row[] = [
    { id: '1', name: 'Иван' },
    { id: '2', name: 'Анна' },
  ];

  it('рендерит строки данными', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />);
    expect(screen.getByText('Иван')).toBeTruthy();
    expect(screen.getByText('Анна')).toBeTruthy();
  });

  it('loading → скелетон (aria-busy), а не пустота', () => {
    render(<DataTable columns={columns} rows={[]} rowKey={(r) => r.id} loading />);
    expect(screen.getByTestId('table-loading').getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByText('Нет данных')).toBeNull();
  });

  it('пусто → EmptyState с действием', () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        emptyTitle="Нет врачей"
        emptyActionLabel="Создать"
        emptyActionHref="/new"
      />,
    );
    expect(screen.getByText('Нет врачей')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Создать' })).toBeTruthy();
  });

  it('ошибка → role=alert с текстом', () => {
    render(
      <DataTable columns={columns} rows={[]} rowKey={(r) => r.id} error="Сервис недоступен" />,
    );
    expect(screen.getByRole('alert').textContent).toContain('Сервис недоступен');
  });
});

describe('FormField (2.2: инпут с label/ошибкой)', () => {
  it('label связан с полем, ошибка видна', () => {
    function Harness() {
      const [value, setValue] = useState('');
      return (
        <FormField
          label="Email"
          name="email"
          value={value}
          onChange={setValue}
          error
          helperText="Неверный формат"
        />
      );
    }

    render(<Harness />);

    const input = screen.getByLabelText('Email');
    fireEvent.change(input, { target: { value: 'a@b.c' } });
    expect((input as HTMLInputElement).value).toBe('a@b.c');
    expect(screen.getByText('Неверный формат')).toBeTruthy();
  });
});

describe('ToastProvider/useToast (2.2: тосты + requestId)', () => {
  it('показывает сообщение ошибки с requestId', () => {
    function Harness() {
      const toast = useToast();
      return (
        <button type="button" onClick={() => toast.error('Не удалось сохранить', 'req-1')}>
          Сохранить
        </button>
      );
    }

    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(screen.getByText('Не удалось сохранить')).toBeTruthy();
    expect(screen.getByTestId('toast-request-id').textContent).toContain('req-1');
  });

  it('useToast вне провайдера → понятная ошибка', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<BrokenToast />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});

function BrokenToast(): React.JSX.Element {
  useToast();
  return <span />;
}
