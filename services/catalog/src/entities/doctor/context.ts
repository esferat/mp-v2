import type { OutboxWriter } from '../../shared/model';
import type { DoctorRepository } from './doctor';

/**
 * Контекст транзакции слайса врача (3.2): карточка + outbox в одной
 * транзакции (бизнес-изменение и событие атомарны, 0.9). Специализацию
 * слайс не тащит в контекст (граница FSD: кросс-импортов между сущностями
 * нет) — порт справочника передаётся в use-case отдельным аргументом.
 */
export interface DoctorContext {
  doctors: DoctorRepository;
  outbox: OutboxWriter;
}
