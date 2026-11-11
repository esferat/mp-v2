import { describe, expect, it } from 'vitest';
import { createDoctorAccount, registerDoctor } from '../src/processes/register-doctor-saga';
import {
  type CatalogDoctors,
  EmailExistsError,
  type UserDirectory,
} from '../src/entities/registration';
import { ConflictError } from '../src/shared/model';

/**
 * In-memory адаптеры саги врача (9.1): без Keycloak и catalog (0.7 AC).
 */
class InMemoryDirectory implements UserDirectory {
  readonly users = new Map<string, string>(); // email → userId
  readonly calls: string[] = [];

  async findByEmail(email: string): Promise<string | null> {
    return this.users.get(email.toLowerCase()) ?? null;
  }

  async createUser(user: { email: string; realmRole?: 'USER' | 'DOCTOR' }): Promise<string> {
    this.calls.push(`create:${user.realmRole ?? 'USER'}:${user.email}`);
    const key = user.email.toLowerCase();
    if (this.users.has(key)) throw new EmailExistsError(user.email);
    const userId = `kc-${this.users.size + 1}`;
    this.users.set(key, userId);
    return userId;
  }

  async deleteUser(userId: string): Promise<void> {
    this.calls.push(`delete:${userId}`);
    for (const [email, id] of this.users) {
      if (id === userId) this.users.delete(email);
    }
  }
}

class InMemoryCatalog implements CatalogDoctors {
  readonly created: Array<{ userId: string; doctorId: string }> = [];
  /** Привязки к СУЩЕСТВУЮЩИМ карточкам (createDoctorAccount, шаг B). */
  readonly linked: Array<{ doctorId: string; userId: string }> = [];
  failNext = false;
  failLink = false;

  async findDoctorByUser(userId: string): Promise<{ id: string } | null> {
    const created = this.created.find((row) => row.userId === userId);
    if (created) return { id: created.doctorId };
    const linked = this.linked.find((row) => row.userId === userId);
    return linked ? { id: linked.doctorId } : null;
  }

  async createDoctor(data: { userId: string }): Promise<{ id: string }> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('catalog недоступен');
    }
    const id = `doc-${this.created.length + 1}`;
    this.created.push({ userId: data.userId, doctorId: id });
    return { id };
  }

  async linkDoctorUser(doctorId: string, userId: string): Promise<void> {
    if (this.failLink) throw new Error('catalog недоступен');
    this.linked.push({ doctorId, userId });
  }
}

const command = {
  email: 'Doctor@Test.MP',
  password: 'Password123!',
  firstName: 'Иван',
  lastName: 'Врачёв',
  specializationId: 'sp-1',
  schedule: { startTime: '09:00', endTime: '18:00', durationMinutes: 30, workDays: [1, 2, 3] },
};

describe('registerDoctor (сага 9.1)', () => {
  it('создаёт пользователя DOCTOR и врача с userId (связка user ↔ doctor)', async () => {
    const directory = new InMemoryDirectory();
    const catalog = new InMemoryCatalog();

    const result = await registerDoctor({ directory, catalog }, command);

    expect(result.userId).toBe('kc-1');
    expect(result.doctorId).toBe('doc-1');
    expect(catalog.created[0]).toEqual({ userId: 'kc-1', doctorId: 'doc-1' });
    expect(directory.calls[0]).toContain('create:DOCTOR');
  });

  it('повтор по тому же email не плодит пользователей (AC 9.1)', async () => {
    const directory = new InMemoryDirectory();
    const catalog = new InMemoryCatalog();

    const first = await registerDoctor({ directory, catalog }, command);
    const second = await registerDoctor(
      { directory, catalog },
      { ...command, email: 'doctor@test.mp' },
    );

    expect(second.userId).toBe(first.userId); // пользователь переиспользован
    const creates = directory.calls.filter((call) => call.startsWith('create:'));
    expect(creates).toHaveLength(1);
  });

  it('сбой catalog удаляет СОЗДАННОГО ЭТОЙ САГОЙ пользователя (компенсация)', async () => {
    const directory = new InMemoryDirectory();
    const catalog = new InMemoryCatalog();
    catalog.failNext = true;

    await expect(registerDoctor({ directory, catalog }, command)).rejects.toThrow(
      'catalog недоступен',
    );
    // пользователь удалён, «висячей» учётки не осталось
    expect(directory.users.size).toBe(0);
    expect(directory.calls.some((call) => call.startsWith('delete:'))).toBe(true);
  });

  it('сбой catalog при СУЩЕСТВУЮЩЕМ пользователе НЕ удаляет чужого (компенсация)', async () => {
    const directory = new InMemoryDirectory();
    const catalog = new InMemoryCatalog();
    await registerDoctor({ directory, catalog }, command); // пользователь + врач созданы

    // Врач потерян (нет привязки), пользователь остался → повтор падает на create
    catalog.created.length = 0;
    catalog.failNext = true;
    await expect(
      registerDoctor({ directory, catalog }, { ...command, email: 'doctor@test.mp' }),
    ).rejects.toThrow('catalog недоступен');

    expect(directory.users.size).toBe(1); // остался прежний пользователь
    expect(directory.calls.filter((call) => call.startsWith('delete:'))).toHaveLength(0);
  });
});

/** Учётная запись для СУЩЕСТВУЮЩЕГО врача (правило «всегда», только ADMIN). */
describe('createDoctorAccount: привязка к существующей карточке', () => {
  const account = {
    email: 'doctor@test.mp',
    password: 'Password123!',
    firstName: 'Иван',
    lastName: 'Врачёв',
  };

  it('создаёт пользователя DOCTOR и привязывает к карточке (карточку НЕ создаёт)', async () => {
    const directory = new InMemoryDirectory();
    const catalog = new InMemoryCatalog();

    const result = await createDoctorAccount(
      { directory, catalog },
      { doctorId: 'doc-9', ...account },
    );

    expect(result.userId).toBe('kc-1');
    expect(catalog.linked).toEqual([{ doctorId: 'doc-9', userId: 'kc-1' }]);
    expect(catalog.created).toHaveLength(0); // шаг B — привязка, а не создание
    expect(directory.calls[0]).toContain('create:DOCTOR');
  });

  it('повтор (тот же email и карточка) — идемпотентен: одна учётка, одна привязка', async () => {
    const directory = new InMemoryDirectory();
    const catalog = new InMemoryCatalog();
    const command = { doctorId: 'doc-9', ...account };

    const first = await createDoctorAccount({ directory, catalog }, command);
    const second = await createDoctorAccount({ directory, catalog }, command);

    expect(second).toEqual(first);
    expect(catalog.linked).toHaveLength(1);
    expect(directory.calls.filter((call) => call.startsWith('create:'))).toHaveLength(1);
  });

  it('email уже привязан к другому врачу → ConflictError с полем email', async () => {
    const directory = new InMemoryDirectory();
    const catalog = new InMemoryCatalog();
    const userId = await directory.createUser({ email: account.email, realmRole: 'DOCTOR' });
    catalog.linked.push({ doctorId: 'doc-other', userId });

    const error = await createDoctorAccount(
      { directory, catalog },
      { doctorId: 'doc-9', ...account },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).details?.field).toBe('email');
    // чужого пользователя не удаляем (компенсация только для созданного здесь)
    expect(directory.calls.filter((call) => call.startsWith('delete:'))).toHaveLength(0);
  });

  it('сбой catalog при СОЗДАННОМ пользователе → компенсация (учётка удалена)', async () => {
    const directory = new InMemoryDirectory();
    const catalog = new InMemoryCatalog();
    catalog.failLink = true;

    await expect(
      createDoctorAccount({ directory, catalog }, { doctorId: 'doc-9', ...account }),
    ).rejects.toThrow('catalog недоступен');

    expect(directory.users.size).toBe(0); // «висячей» учётки не осталось
    expect(directory.calls.some((call) => call.startsWith('delete:'))).toBe(true);
  });

  it('сбой catalog при СУЩЕСТВУЮЩЕМ пользователе → чужой не удаляется', async () => {
    const directory = new InMemoryDirectory();
    const catalog = new InMemoryCatalog();
    await directory.createUser({ email: account.email, realmRole: 'DOCTOR' }); // уже есть
    catalog.failLink = true;

    await expect(
      createDoctorAccount({ directory, catalog }, { doctorId: 'doc-9', ...account }),
    ).rejects.toThrow('catalog недоступен');

    expect(directory.users.size).toBe(1);
    expect(directory.calls.filter((call) => call.startsWith('delete:'))).toHaveLength(0);
  });
});
