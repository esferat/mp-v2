import type { OutboxWriter } from '../../shared/model';
import type { SpecializationRepository } from './repository';

/**
 * Контекст транзакции каталога: всё, что нужно use-case'у для записи,
 * в одной транзакции БД (бизнес-изменение + outbox — атомарно, 0.9).
 */
export interface SpecializationContext {
  specializations: SpecializationRepository;
  outbox: OutboxWriter;
}
