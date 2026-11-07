import type { OutboxWriter } from '../../shared/model';
import type { FileRepository } from './file';

/**
 * Контекст транзакции слайса файла (4.4): реестр + outbox в одной
 * транзакции (строка и событие document.* атомарны, 0.9).
 */
export interface FileContext {
  files: FileRepository;
  outbox: OutboxWriter;
}
