import { describe, expect, it } from 'vitest';
import { doctorListQuerySchema } from '../src/api/catalog';

/**
 * Query-схема списка врачей (0.6 + 3.1): фильтры из макета design/doctors-list.md
 * (специализация/статус) должны проходить валидацию и доезжать до сервиса.
 */
describe('doctorListQuerySchema (3.1: фильтры списка врачей)', () => {
  it('принимает пагинацию и все три фильтра разом', () => {
    expect(
      doctorListQuerySchema.parse({
        offset: '10',
        limit: '10',
        search: 'Иванов',
        status: 'ACTIVE',
        specId: 'sp-42',
      }),
    ).toEqual({ offset: 10, limit: 10, search: 'Иванов', status: 'ACTIVE', specId: 'sp-42' });
  });

  it('без фильтров — дефолты пагинации', () => {
    expect(doctorListQuerySchema.parse({})).toEqual({ offset: 0, limit: 20 });
  });

  it('пустой specId отклоняется (запрос без фильтра — не пустая строка)', () => {
    expect(doctorListQuerySchema.safeParse({ specId: '' }).success).toBe(false);
  });

  it('неизвестный статус и лимит > 100 отклоняются', () => {
    expect(doctorListQuerySchema.safeParse({ status: 'FROZEN' }).success).toBe(false);
    expect(doctorListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});
