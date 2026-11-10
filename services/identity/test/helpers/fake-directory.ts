import {
  EmailExistsError,
  type UserDirectory,
  type UserProfileData,
} from '../../src/entities/registration';

/**
 * In-memory Keycloak для тестов (1.4/10.1): регистрация/компенсация и
 * правка профиля проверяются без инфраструктуры (0.7 AC: тесты проходят
 * без запущенных сервисов).
 */
export class FakeDirectory implements UserDirectory {
  readonly users = new Map<string, string>(); // email → userId
  /** Профили по userId (10.1). */
  readonly profiles = new Map<string, UserProfileData>();
  createCalls = 0;
  deleteCalls: string[] = [];
  failCreateWith: Error | null = null;

  async findByEmail(email: string): Promise<string | null> {
    return this.users.get(email.toLowerCase()) ?? null;
  }

  async createUser(user: {
    email: string;
    firstName?: string;
    lastName?: string;
  }): Promise<string> {
    this.createCalls += 1;
    if (this.failCreateWith) throw this.failCreateWith;
    const email = user.email.toLowerCase();
    if (this.users.has(email)) throw new EmailExistsError(email);
    const userId = `kc-${this.users.size + 1}`;
    this.users.set(email, userId);
    this.profiles.set(userId, {
      email: user.email,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
    });
    return userId;
  }

  async deleteUser(userId: string): Promise<void> {
    this.deleteCalls.push(userId);
    for (const [email, id] of this.users) if (id === userId) this.users.delete(email);
    this.profiles.delete(userId);
  }

  async findProfile(userId: string): Promise<UserProfileData | null> {
    return this.profiles.get(userId) ?? null;
  }

  async updateProfile(
    userId: string,
    patch: { email?: string; firstName?: string; lastName?: string },
  ): Promise<UserProfileData> {
    const current = this.profiles.get(userId);
    if (!current) throw new Error(`пользователь ${userId} не существует (настройка теста)`);

    const nextEmail = patch.email?.trim() || current.email;
    if (nextEmail.toLowerCase() !== current.email.toLowerCase()) {
      const taken = await this.findByEmail(nextEmail);
      if (taken && taken !== userId) throw new EmailExistsError(nextEmail);
      // логин следует за email (username = email)
      for (const [email, id] of this.users) {
        if (id === userId) this.users.delete(email);
      }
      this.users.set(nextEmail.toLowerCase(), userId);
    }

    const updated: UserProfileData = {
      email: nextEmail,
      firstName: patch.firstName ?? current.firstName,
      lastName: patch.lastName ?? current.lastName,
    };
    this.profiles.set(userId, updated);
    return updated;
  }
}
