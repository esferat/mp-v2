import type { OutboxWriter } from '../../shared/model';
import type { PatientRepository } from './patient';

/**
 * Контекст транзакции карточки пациента (4.2/4.6): изменение и событие
 * patient.* пишутся в одной транзакции (outbox, 0.9).
 */
export interface PatientContext {
  patients: PatientRepository;
  outbox: OutboxWriter;
}
