import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ErrorState } from '../src/shared/ui';
import { ApiError } from '../src/shared/api/errors';

describe('ErrorState (2.4: обработчик ошибок)', () => {
  it('бизнес-ошибка (409) → warning, без кнопки «Повторить», текст локальный', () => {
    const retry = vi.fn();
    render(
      <ErrorState
        error={new ApiError('Слот только что заняли', { code: 'SLOT_TAKEN', status: 409 })}
        onRetry={retry}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain('Слот только что заняли');
    // Локальная бизнес-ошибка — не ретраим автоматически (2.4)
    expect(screen.queryByRole('button', { name: 'Повторить' })).toBeNull();
    expect(retry).not.toHaveBeenCalled();
  });

  it('5xx → общий экран с requestId и кнопкой «Повторить» (AC 2.4)', () => {
    const retry = vi.fn();
    render(
      <ErrorState
        error={
          new ApiError('Внутренняя ошибка сервера', {
            code: 'INTERNAL_ERROR',
            status: 500,
            requestId: 'trace-xyz',
          })
        }
        onRetry={retry}
      />,
    );

    expect(screen.getByTestId('error-request-id').textContent).toContain('trace-xyz');
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('сетевая ошибка → тоже retry-экран', () => {
    render(<ErrorState error={new TypeError('fetch failed')} onRetry={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('fetch failed');
  });

  it('без onRetry кнопки нет (сторонний контекст)', () => {
    render(<ErrorState error={new ApiError('Нет записи', { code: 'NOT_FOUND', status: 404 })} />);
    expect(screen.queryByRole('button', { name: 'Повторить' })).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('Нет записи');
  });
});
