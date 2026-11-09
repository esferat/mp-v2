import { describe, expect, it } from 'vitest';
import type { RegisterRequest } from '@mp/contracts';
import { PatientServiceError, type PatientCards } from '../src/entities/registration';
import { registerUser, type RegisterSagaDeps } from '../src/processes/register-user-saga';
import { FakeDirectory } from './helpers/fake-directory';

/**
 * In-memory фейки: Keycloak и patient-service без сети (1.4 — тесты ядра
 * на подменённых портах, PostgreSQL/RabbitMQ не нужны).
 */
class FakeCards implements PatientCards {
  readonly cards = new Map<string, { id: string }>();
  failNextCreate = false;
  createCalls = 0;

  async findByUserId(userId: string): Promise<{ id: string } | null> {
    return this.cards.get(userId) ?? null;
  }

  async create(card: { userId: string }): Promise<{ id: string }> {
    this.createCalls += 1;
    if (this.failNextCreate) {
      this.failNextCreate = false;
      throw new PatientServiceError('connection refused');
    }
    const existing = this.cards.get(card.userId);
    if (existing) return existing;
    const created = { id: `pt-${this.cards.size + 1}` };
    this.cards.set(card.userId, created);
    return created;
  }
}

function makeDeps(overrides: Partial<RegisterSagaDeps> = {}) {
  const directory = new FakeDirectory();
  const cards = new FakeCards();
  const events: { routingKey: string; payload: unknown }[] = [];
  const deps: RegisterSagaDeps = {
    directory,
    cards,
    outbox: {
      enqueue: async (routingKey, payload) => {
        events.push({ routingKey, payload });
      },
    },
    ...overrides,
  };
  return { deps, directory, cards, events };
}

const command: RegisterRequest = {
  email: 'New@Test.MP',
  password: 'password123',
  firstName: 'Иван',
  lastName: 'Петров',
  birthDate: '1990-01-01',
};

describe('registerUser (сага 1.4)', () => {
  it('успех: пользователь + карточка + событие user.registered.v1', async () => {
    const { deps, directory, cards, events } = makeDeps();

    const result = await registerUser(deps, command);

    expect(result.userId).toBe('kc-1');
    expect(result.email).toBe('new@test.mp'); // нормализация email
    expect(directory.users.size).toBe(1);
    expect(cards.cards.size).toBe(1);
    expect(events).toHaveLength(1);
    expect(events[0]?.routingKey).toBe('user.registered.v1');
    // в событии нет пароля (AC: пароль не логируется/не утекает)
    expect(JSON.stringify(events[0]?.payload)).not.toContain('password123');
  });

  it('двойной submit → одна учётная запись и одна карточка (AC)', async () => {
    const { deps, directory, cards, events } = makeDeps();

    await registerUser(deps, command);
    await registerUser(deps, { ...command, email: 'new@test.mp' });

    expect(directory.users.size).toBe(1);
    expect(directory.createCalls).toBe(1);
    expect(cards.cards.size).toBe(1);
    expect(cards.createCalls).toBe(1);
    expect(events).toHaveLength(1); // повтор без дубля события
  });

  it('пользователь есть (EMAIL_EXISTS гонки), карточки нет → дособирает без дубля', async () => {
    const { deps, directory, cards } = makeDeps();
    // «другой параллельный запрос» успел создать пользователя
    await directory.createUser({ email: 'new@test.mp' });

    const result = await registerUser(deps, command);

    expect(result.userId).toBe('kc-1');
    expect(directory.users.size).toBe(1);
    expect(directory.createCalls).toBe(1); // повторный create не вызывался
    expect(cards.cards.size).toBe(1);
  });

  it('отказ patient-service → компенсация: «висячего» пользователя не остаётся (AC)', async () => {
    const { deps, directory, cards } = makeDeps();
    cards.failNextCreate = true;

    await expect(registerUser(deps, command)).rejects.toBeInstanceOf(PatientServiceError);
    expect(directory.deleteCalls).toEqual(['kc-1']); // создан нами → удалён
    expect(directory.users.size).toBe(0); // «висячего» пользователя нет
    expect(cards.cards.size).toBe(0);
  });

  it('после компенсации повтор завершается: ровно один пользователь и одна карточка', async () => {
    const { deps, directory, cards } = makeDeps();
    cards.failNextCreate = true;

    await expect(registerUser(deps, command)).rejects.toThrow();
    const retry = await registerUser(deps, command);

    expect(retry.userId).toBe('kc-1');
    expect(directory.users.size).toBe(1);
    expect(cards.cards.size).toBe(1);
  });

  it('НЕ удаляет существовавшего ранее пользователя при отказе карточки', async () => {
    const { deps, directory, cards } = makeDeps();
    // Пользователь существовал ДО саги (например, прошлая неудачная регистрация
    // оставила его, потому что сага упала до компенсации)
    await directory.createUser({ email: 'new@test.mp' });
    cards.failNextCreate = true;

    await expect(registerUser(deps, command)).rejects.toBeInstanceOf(PatientServiceError);
    expect(directory.deleteCalls).toEqual([]); // чужого не трогаем
    expect(directory.users.size).toBe(1);
  });

  it('ошибка валидации/Keycloak не маскируется (пробрасывается как есть)', async () => {
    const { deps, directory } = makeDeps();
    directory.failCreateWith = new Error('Keycloak admin create user: HTTP 500');

    await expect(registerUser(deps, command)).rejects.toThrow(/HTTP 500/);
  });
});
