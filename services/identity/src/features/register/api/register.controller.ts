import { Body, Controller, Inject, Post } from '@nestjs/common';
import { registerRequestSchema, type RegisterRequest, type RegisterResponse } from '@mp/contracts';
import { OutboxService } from '@mp/service-kit';
import {
  PATIENT_CARDS,
  USER_DIRECTORY,
  type PatientCards,
  type UserDirectory,
} from '../../../entities/registration';
import { ZodPipe } from '../../../shared/lib';
import { registerUser, type RegisterSagaDeps } from '../../../processes/register-user-saga';

/**
 * Адаптер входа (fsd.md §4.2): Zod-валидация контракта (в т.ч. birthDate
 * не в будущем) → вызов публичного API процесса саги. Бизнес-логики нет.
 *
 * Публичный маршрут (регистрация до входа): gateway пропускает без токена,
 * rate-limit жёсткий (1.2).
 */
@Controller('api/identity')
export class RegisterController {
  private readonly deps: RegisterSagaDeps;

  constructor(
    @Inject(USER_DIRECTORY) directory: UserDirectory,
    @Inject(PATIENT_CARDS) cards: PatientCards,
    outbox: OutboxService,
  ) {
    this.deps = { directory, cards, outbox };
  }

  @Post('register')
  register(
    @Body(new ZodPipe(registerRequestSchema)) body: RegisterRequest,
  ): Promise<RegisterResponse> {
    return registerUser(this.deps, body);
  }
}
