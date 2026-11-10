/** Письмо (6.2): адресат, тема и текст — всё, что нужно SMTP-адаптеру. */
export interface Letter {
  to: string;
  /** Тема письма (ru, по шаблону). */
  subject: string;
  /** Текст письма (ru, по шаблону; plain text — MVP). */
  text: string;
}

/**
 * Порт отправки писем (hexagonal: порт в entities, nodemailer-адаптер —
 * в shared/api/smtp.client.ts). Бросает TransientConsumerError при недоступном
 * SMTP (сообщение вернётся в очередь) и PermanentConsumerError при
 * недоставляемом адресе (→ DLQ, спека 6.2).
 */
export interface MailSender {
  send(letter: Letter): Promise<void>;
}

/** DI-токен MailSender (сборка — в app/app.module.ts через SharedApiModule). */
export const MAIL_SENDER = Symbol('NotificationMailSender');

/**
 * Снимок записи, на котором строятся письма о приёме (6.2: submitted/approved/
 * declined/cancelled используют один снапшот appointmentCore из контракта).
 * Живёт в entities, а не в features: слайсы не импортируют друг друга (fsd.md §2).
 */
export interface AppointmentLetterData {
  appointmentId: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  specializationName: string;
  slot: { localDate: string; start: string; end: string };
  /** Причина отказа (только для declined). */
  reason?: string;
}
