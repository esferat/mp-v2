import type { Letter, MailSender } from './mail';

/**
 * Карточка пациента, достаточная для адресации письма (6.2).
 * В событиях appointment.* email НЕ денализован (PII, architecture §6) —
 * получатель резолвится по patientId через patient-service.
 */
export interface PatientEmailInfo {
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  /** Keycloak sub владельца — для проверки «загрузил не он сам» (6.2). */
  userId: string;
}

/** Порт резолва получателя (реализация — shared/api/patient.http.client.ts). */
export interface PatientEmailSource {
  /** null — карточки нет (пациент удалён): письмо не отправляется, без DLQ. */
  findById(patientId: string): Promise<PatientEmailInfo | null>;
}

/** DI-токен PatientEmailSource (сборка — в app/app.module.ts). */
export const PATIENT_EMAIL_SOURCE = Symbol('NotificationPatientEmailSource');

/** Зависимости отправки писем. */
export interface SendDeps {
  mail: MailSender;
  patients: PatientEmailSource;
  /** Разобранный env-whitelist адресов, на которые НЕ шлём (6.2). */
  skip: readonly string[];
}

/** DI-токен готовых зависимостей отправки (сборка — в app/app.module.ts). */
export const SEND_DEPS = Symbol('NotificationSendDeps');

/** Результат отправки — для логов и тестов. */
export type SendOutcome = 'sent' | 'skipped' | 'no-recipient';

/**
 * Разбор NOTIFY_SKIP_RECIPIENTS (env-whitelist, 6.2): через запятую,
 * элемент — точный адрес (`bot@example.com`) или домен (`@test.mp`).
 */
export function parseSkipList(raw: string): string[] {
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

/** Входит ли адрес в skip-whitelist (точное совпадение или домен). */
export function isSkipped(email: string, skip: readonly string[]): boolean {
  const normalized = email.trim().toLowerCase();
  return skip.some((entry) =>
    entry.startsWith('@') ? normalized.endsWith(entry) : normalized === entry,
  );
}

/** Отправка произвольного письма с учётом skip-whitelist (6.2). */
export async function sendLetter(
  deps: Pick<SendDeps, 'mail' | 'skip'>,
  letter: Letter,
): Promise<SendOutcome> {
  if (isSkipped(letter.to, deps.skip)) return 'skipped';
  await deps.mail.send(letter);
  return 'sent';
}

/**
 * Адресация письма пациенту: резолв email по patientId → skip-whitelist → отправка.
 *
 * @param options.uploadedBy — sub загрузившего; равен userId владельца →
 *   «загрузил не он сам» не выполняется, письмо пропускается (6.2).
 */
export async function sendPatientLetter(
  deps: SendDeps,
  patientId: string,
  build: (patient: PatientEmailInfo) => Letter,
  options: { uploadedBy?: string } = {},
): Promise<SendOutcome> {
  const patient = await deps.patients.findById(patientId);
  if (!patient?.email) return 'no-recipient';
  if (options.uploadedBy !== undefined && options.uploadedBy === patient.userId) return 'skipped';
  return sendLetter(deps, build(patient));
}
