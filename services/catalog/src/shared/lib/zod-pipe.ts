import { PipeTransform, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { ValidationError } from '../model';

/**
 * Zod-валидация входа (0.6: Zod — единственный источник истины).
 * Используется в controller-ах как параметризованный pipe:
 *   @Body(new ZodPipe(createSpecializationSchema)) body: CreateSpecializationRequest
 */
@Injectable()
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue?.path.join('.') || undefined;
      throw new ValidationError(issue?.message ?? 'Некорректные данные', field);
    }

    return result.data;
  }
}
