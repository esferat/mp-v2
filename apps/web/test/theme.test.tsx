import { describe, expect, it } from 'vitest';
import { theme } from '../src/shared/ui';

/**
 * Smoke-тесты каркаса (0.1/0.7): проект собирается, тема — единая точка
 * дизайн-системы. React-тесты компонентов — задачи 2.x.
 */
describe('shared/ui theme', () => {
  it('создаёт тему с обязательными токенами', () => {
    expect(theme.palette.primary.main).toBe('#1976d2');
    expect(theme.shape.borderRadius).toBe(8);
    expect(theme.typography.fontFamily).toContain('Inter');
  });

  it('компоненты наследуют тему (MUI резолвит дефолты)', () => {
    expect(theme.components?.MuiButton?.defaultProps?.disableElevation).toBe(true);
  });
});
