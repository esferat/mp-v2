import { describe, expect, it } from 'vitest';
import { buildWhere } from '../src/shared/api/prisma.doctor-repository';

/**
 * Фильтр списка врачей на уровне Prisma-WHERE (3.1: фильтр специализации):
 * проверяется без поднятия БД (0.7 AC: ядро и маппинг тестируются без инфраструктуры).
 */
describe('buildWhere (3.1: WHERE списка врачей)', () => {
  it('специализация → equality по specializationId', () => {
    expect(buildWhere({ offset: 0, limit: 10, specId: 'sp-42' })).toEqual({
      specializationId: 'sp-42',
    });
  });

  it('статус и специализация сочетаются (AND)', () => {
    expect(buildWhere({ offset: 0, limit: 10, specId: 'sp-1', status: 'ACTIVE' })).toEqual({
      status: 'ACTIVE',
      specializationId: 'sp-1',
    });
  });

  it('поиск по ФИО регистронезависим и не теряет фильтры', () => {
    const where = buildWhere({ offset: 0, limit: 10, specId: 'sp-2', search: 'Иванов' });
    expect(where.specializationId).toBe('sp-2');
    expect(where.OR).toEqual([
      { lastName: { contains: 'Иванов', mode: 'insensitive' } },
      { firstName: { contains: 'Иванов', mode: 'insensitive' } },
      { middleName: { contains: 'Иванов', mode: 'insensitive' } },
    ]);
  });

  it('без фильтров — пустой WHERE (список всего)', () => {
    expect(buildWhere({ offset: 0, limit: 10 })).toEqual({});
    expect(buildWhere({ offset: 0, limit: 10, search: '   ' })).toEqual({});
  });
});
