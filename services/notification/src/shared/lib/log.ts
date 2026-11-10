import type { Logger } from '@mp/service-kit';

/**
 * Лог итога отправки письма (6.2): успех — debug, пропуск по whitelist — info,
 * недоступный получатель — warn (каждый исход виден в логах, без дублей).
 *
 * @param outcome — строка из SendOutcome (entities/mail), чтобы shared не зависел от entities.
 */
export function logSendOutcome(
  log: Logger,
  outcome: string,
  context: Record<string, unknown>,
): void {
  if (outcome === 'sent') {
    log.debug(context, 'письмо отправлено');
  } else if (outcome === 'skipped') {
    log.info({ ...context, outcome }, 'письмо пропущено');
  } else {
    log.warn({ ...context, outcome }, 'получатель не найден — письмо не отправлено');
  }
}
