import { describe, expect, it } from 'vitest';
import type { DoctorListItem, DoctorListQuery, DoctorRepository } from '../src/entities/doctor';
import { getDoctors } from '../src/features/get-doctors';

/**
 * In-memory репозиторий: имитирует поиск/пагинацию порта (3.1) —
 * тест проходит без PostgreSQL (0.7 AC).
 */
class InMemoryDoctorRepository implements DoctorRepository {
  readonly rows: DoctorListItem[] = [];

  seed(count: number, overrides: Partial<DoctorListItem> = {}): void {
    for (let i = 1; i <= count; i += 1) {
      const id = `d-${i}`;
      this.rows.push({
        id,
        firstName: `Имя${i}`,
        lastName: `Фамилия${i}`,
        specializationId: 'sp-1',
        specializationName: 'Терапевт',
        status: 'ACTIVE',
        schedule: {
          startTime: '09:00',
          endTime: '17:00',
          durationMinutes: 30,
          workDays: [1, 2, 3, 4, 5],
        },
        ...overrides,
      });
    }
  }

  async findPage(query: DoctorListQuery): Promise<{ items: DoctorListItem[]; total: number }> {
    const search = query.search?.trim().toLowerCase();
    const filtered = search
      ? this.rows.filter((row) =>
          [row.lastName, row.firstName, row.middleName]
            .filter(Boolean)
            .some((part) => (part as string).toLowerCase().includes(search)),
        )
      : this.rows;

    return {
      items: filtered.slice(query.offset, query.offset + query.limit),
      total: filtered.length,
    };
  }
}

const query = (overrides: Partial<DoctorListQuery> = {}): DoctorListQuery => ({
  offset: 0,
  limit: 20,
  ...overrides,
});

describe('getDoctors (use-case, 3.1)', () => {
  it('возвращает страницу и total (пагинация без дублей — AC)', async () => {
    const repository = new InMemoryDoctorRepository();
    repository.seed(25);

    const first = await getDoctors(repository, undefined, query({ limit: 10, offset: 0 }));
    const second = await getDoctors(repository, undefined, query({ limit: 10, offset: 10 }));
    const third = await getDoctors(repository, undefined, query({ limit: 10, offset: 20 }));

    expect(first.total).toBe(25);
    expect(first.items).toHaveLength(10);
    expect(second.items).toHaveLength(10);
    expect(third.items).toHaveLength(5);

    // Ни дублей, ни пропусков между страницами
    const ids = [...first.items, ...second.items, ...third.items].map((item) => item.id);
    expect(new Set(ids).size).toBe(25);
    expect(ids).toHaveLength(25);
  });

  it('поиск по ФИО фильтрует и учитывает total', async () => {
    const repository = new InMemoryDoctorRepository();
    repository.seed(3); // Фамилия1, Фамилия2, Фамилия3
    repository.seed(1);
    repository.rows[3]!.lastName = 'Петров';
    repository.rows[3]!.firstName = 'Иван';

    const result = await getDoctors(repository, undefined, query({ search: 'петров' }));

    expect(result.total).toBe(1);
    expect(result.items[0]?.lastName).toBe('Петров');
  });

  it('подписывает фото presigned-ссылкой (TTL-подпись) и убирает photoKey', async () => {
    const repository = new InMemoryDoctorRepository();
    repository.seed(1, { photoKey: 'd-1/photo.jpg' });

    const signer = { sign: async (key: string) => `https://minio/signed/${key}` };
    const result = await getDoctors(repository, signer, query());

    expect(result.items[0]?.photoUrl).toBe('https://minio/signed/d-1/photo.jpg');
    // Внутренний ключ MinIO не утекает в API (3.1/0.5)
    expect(result.items[0]).not.toHaveProperty('photoKey');
  });

  it('без фото — photoUrl отсутствует (не undefined-поле)', async () => {
    const repository = new InMemoryDoctorRepository();
    repository.seed(2);

    const signer = { sign: async () => 'https://never-called' };
    const result = await getDoctors(repository, signer, query());

    expect(result.items[0]).not.toHaveProperty('photoUrl');
    expect(result.items[1]).not.toHaveProperty('photoUrl');
  });

  it('пустой список → items: [], total: 0 (empty-state на витрине)', async () => {
    const repository = new InMemoryDoctorRepository();

    await expect(getDoctors(repository, undefined, query())).resolves.toEqual({
      items: [],
      total: 0,
    });
  });
});
