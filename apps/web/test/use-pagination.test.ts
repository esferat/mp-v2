import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { computePagination, usePagination } from '../src/shared/lib/use-pagination';

// next/navigation подменяется для изоляции хука (URL-синхронизация)
const push = vi.fn();
let currentParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/admin/doctors',
  useSearchParams: () => currentParams,
}));

afterEach(() => {
  cleanup();
  push.mockClear();
  currentParams = new URLSearchParams();
});

describe('computePagination (2.5: чистая логика)', () => {
  it('25 элементов, limit 10 → 3 страницы; границы кнопок корректны', () => {
    const first = computePagination({ page: 0, limit: 10, total: 25, loadedPages: 0 });
    expect(first).toMatchObject({
      offset: 0,
      pageCount: 3,
      previousDisabled: true,
      nextDisabled: false,
    });

    const middle = computePagination({ page: 1, limit: 10, total: 25, loadedPages: 0 });
    expect(middle.offset).toBe(10);
    expect(middle.previousDisabled).toBe(false);
    expect(middle.nextDisabled).toBe(false);

    const last = computePagination({ page: 2, limit: 10, total: 25, loadedPages: 0 });
    expect(last.offset).toBe(20);
    expect(last.nextDisabled).toBe(true); // последняя страница
  });

  it('total неизвестен → накопление страниц управляет «вперёд»', () => {
    // Загружена только текущая страница → «вперёд» недоступно
    expect(computePagination({ page: 0, limit: 20, total: 0, loadedPages: 1 }).nextDisabled).toBe(
      true,
    );
    // Накопили ещё → можно идти дальше
    expect(computePagination({ page: 0, limit: 20, total: 0, loadedPages: 2 }).nextDisabled).toBe(
      false,
    );
  });

  it('offset не дублируется между страницами (нет дублей — AC 2.5)', () => {
    const offsets = [0, 1, 2].map(
      (page) => computePagination({ page, limit: 10, total: 30, loadedPages: 0 }).offset,
    );
    expect(offsets).toEqual([0, 10, 20]);
    expect(new Set(offsets).size).toBe(offsets.length);
  });
});

describe('usePagination (2.5: навигация + URL)', () => {
  it('чтит номер из URL (восстановление после F5)', () => {
    currentParams = new URLSearchParams('page=2');

    const { result } = renderHook(() => usePagination({ limit: 10, total: 30 }));

    expect(result.current.page).toBe(2);
    expect(result.current.offset).toBe(20);
  });

  it('next/previous двигают страницу и пишут URL', () => {
    const { result, rerender } = renderHook(() => usePagination({ limit: 10, total: 30 }));

    expect(result.current.previousDisabled).toBe(true);

    // Эмуляция навигации: после push роутер обновляет searchParams → rerender
    act(() => {
      result.current.next();
    });
    currentParams = new URLSearchParams('page=1');
    rerender();
    expect(push).toHaveBeenLastCalledWith('/admin/doctors?page=1');

    act(() => {
      result.current.next();
    });
    currentParams = new URLSearchParams('page=2');
    rerender();
    expect(push).toHaveBeenLastCalledWith('/admin/doctors?page=2');
    expect(result.current.nextDisabled).toBe(true); // последняя (30/10)

    act(() => {
      result.current.previous();
    });
    currentParams = new URLSearchParams('page=1');
    rerender();
    expect(push).toHaveBeenLastCalledWith('/admin/doctors?page=1');
  });

  it('возврат на первую страницу убирает ?page= из URL', () => {
    currentParams = new URLSearchParams('page=1');
    const { result } = renderHook(() => usePagination({ limit: 10, total: 30 }));

    act(() => result.current.previous());
    expect(push).toHaveBeenLastCalledWith('/admin/doctors');
  });

  it('setPage не выходит за границы вниз (не уходит в минус)', () => {
    const { result } = renderHook(() => usePagination({ limit: 10, total: 30 }));

    act(() => result.current.setPage(-5));
    expect(push).toHaveBeenLastCalledWith('/admin/doctors');
  });

  it('withLoading ставит и снимает состояние загрузки', async () => {
    const { result } = renderHook(() => usePagination({ limit: 10, total: 30 }));

    let resolveTask!: (value: string) => void;
    const task = new Promise<string>((resolve) => {
      resolveTask = resolve;
    });

    let pending!: Promise<string>;
    act(() => {
      pending = result.current.withLoading(() => task);
    });
    expect(result.current.loading).toBe(true);

    resolveTask('ok');
    await act(async () => {
      await pending;
    });

    expect(result.current.loading).toBe(false);
  });

  it('withLoading снимает loading и при ошибке', async () => {
    const { result } = renderHook(() => usePagination({ limit: 10, total: 30 }));

    await act(async () => {
      await expect(
        result.current.withLoading(() => Promise.reject(new Error('boom'))),
      ).rejects.toThrow('boom');
    });

    expect(result.current.loading).toBe(false);
  });
});
