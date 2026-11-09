import { RoutingKeys, type RegisterRequest, type RegisterResponse } from '@mp/contracts';
import { createEvent, type OutboxService } from '@mp/service-kit';
import {
  EmailExistsError,
  type PatientCards,
  type UserDirectory,
} from '../../entities/registration';
import { ConflictError } from '../../shared/model';

/**
 * Зависимости саги: только порты — ядро не знает про HTTP/Keycloak (1.4).
 */
export interface RegisterSagaDeps {
  directory: UserDirectory;
  cards: PatientCards;
  /** Порт outbox (реализация — OutboxService из service-kit, та же транзакция не нужна: сага распределённая). */
  outbox: Pick<OutboxService, 'enqueue'>;
}

/**
 * Сага регистрации (1.4): атомарная с точки зрения пользователя последовательность
 *
 *   A. пользователь в Keycloak (роль USER) — идемпотентно по email;
 *   B. карточка в patient-service — идемпотентно по userId;
 *   компенсация: при ошибке B созданный НА ЭТОЙ САГЕ пользователь удаляется
 *   (best-effort, ретраи) — «висячих» пользователей не остаётся (AC).
 *
 * Идемпотентность повтора: существующий пользователь без карточки → карточка
 * дособирается без дубля учётной записи (AC: двойной submit → одна запись
 * и одна карточка).
 */
export async function registerUser(
  deps: RegisterSagaDeps,
  command: RegisterRequest,
): Promise<RegisterResponse> {
  const email = command.email.toLowerCase();

  // --- Шаг A: учётная запись Keycloak ---------------------------------------
  let userId = await deps.directory.findByEmail(email);
  let createdOnThisSaga = false;

  if (!userId) {
    try {
      userId = await deps.directory.createUser({
        email,
        password: command.password,
        firstName: command.firstName,
        lastName: command.lastName,
        ...(command.middleName ? { middleName: command.middleName } : {}),
        birthDate: command.birthDate,
      });
      createdOnThisSaga = true;
    } catch (error) {
      if (!(error instanceof EmailExistsError)) throw error;
      // Гонка двойного submit: другой запрос успел первым — переиспользуем его
      userId = await deps.directory.findByEmail(email);
      if (!userId) throw new ConflictError('Email уже зарегистрирован', { field: 'email' });
    }
  }

  // --- Шаг B: карточка пациента --------------------------------------------
  // Оба вызова (чтение и запись) — под компенсацией: отказ patient-service
  // не оставляет «висячего» пользователя, даже если сбой случился на чтении
  // (сеть/таймаут) — AC 1.4 «отказ patient-service не оставляет висячего».
  try {
    const existingCard = await deps.cards.findByUserId(userId);
    if (existingCard) {
      // Уже всё есть (повтор submit) — без дублей и без повторного события
      return { userId, email };
    }

    await deps.cards.create({
      userId,
      email,
      firstName: command.firstName,
      lastName: command.lastName,
      ...(command.middleName ? { middleName: command.middleName } : {}),
      birthDate: command.birthDate,
    });
  } catch (error) {
    // Компенсация: удаляем только пользователя, созданного ЭТОЙ сагой —
    // чужого (существовавшего) не трогаем.
    if (createdOnThisSaga) {
      await deps.directory.deleteUser(userId);
    }
    throw error;
  }

  // Успех → событие для письма (notification). Событие — только при СОЗДАНИИ
  // карточки: повтор не шлёт дубль.
  await deps.outbox.enqueue(
    RoutingKeys.UserRegistered,
    createEvent({ userId, email, locale: 'ru' }),
  );

  return { userId, email };
}
