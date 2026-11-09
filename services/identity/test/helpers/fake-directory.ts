import { EmailExistsError, type UserDirectory } from '../../src/entities/registration';

/**
 * In-memory Keycloak для тестов (1.4): регистрация/компенсация проверяются
 * без инфраструктуры (0.7 AC: тесты проходят без запущенных сервисов).
 */
export class FakeDirectory implements UserDirectory {
  readonly users = new Map<string, string>(); // email → userId
  createCalls = 0;
  deleteCalls: string[] = [];
  failCreateWith: Error | null = null;

  async findByEmail(email: string): Promise<string | null> {
    return this.users.get(email.toLowerCase()) ?? null;
  }

  async createUser(user: { email: string }): Promise<string> {
    this.createCalls += 1;
    if (this.failCreateWith) throw this.failCreateWith;
    const email = user.email.toLowerCase();
    if (this.users.has(email)) throw new EmailExistsError(email);
    const userId = `kc-${this.users.size + 1}`;
    this.users.set(email, userId);
    return userId;
  }

  async deleteUser(userId: string): Promise<void> {
    this.deleteCalls.push(userId);
    for (const [email, id] of this.users) if (id === userId) this.users.delete(email);
  }
}
