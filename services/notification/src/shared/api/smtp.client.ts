import { createTransport, type Transporter } from 'nodemailer';
import { PermanentConsumerError, TransientConsumerError } from '@mp/service-kit';
import type { Letter, MailSender } from '../../entities/mail';
import type { NotificationEnv } from '../config';

/**
 * SMTP-адаптер (6.2): nodemailer → письмо по шаблону, отладка — Mailpit в dev.
 *
 * Классификация ошибок (спека 6.2 «ретраи SMTP, недоставляемый адрес → DLQ»):
 *  - сбой соединения/таймаут (ECONNREFUSED, ETIMEDOUT, …) → TransientConsumerError:
 *    сообщение возвращается в очередь и доставляется после восстановления SMTP
 *    (AC «падение SMTP → копятся и доставляются, без потерь»);
 *  - SMTP 5xx (адрес не существует, отклонён) → PermanentConsumerError: ретраи
 *    бессмысленны → DLQ сразу, очередь не блокируется;
 *  - прочие ошибки → обычные ретраи обёртки, затем DLQ.
 */
export class SmtpMailSender implements MailSender {
  private readonly transport: Transporter;
  private readonly from: string;

  constructor(env: NotificationEnv) {
    this.from = env.SMTP_FROM;
    this.transport = createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      // Mailpit в dev принимает без аутентификации; в проде SMTP_USER/SMTP_PASSWORD.
      ...(env.SMTP_USER && env.SMTP_PASSWORD
        ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
        : {}),
      connectionTimeout: env.SERVICE_TIMEOUT_MS,
      greetingTimeout: env.SERVICE_TIMEOUT_MS,
    });
  }

  async send(letter: Letter): Promise<void> {
    try {
      await this.transport.sendMail({
        from: this.from,
        to: letter.to,
        subject: letter.subject,
        text: letter.text,
      });
    } catch (error) {
      throw classifySmtpError(error);
    }
  }
}

/** Маппинг ошибок nodemailer на типы обработчиков 6.3. */
export function classifySmtpError(error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string } | null)?.code;
  const responseCode = (error as { responseCode?: number } | null)?.responseCode;

  // SMTP 5xx: адресат недоступен/отклонён — повтор бессмыслен → DLQ.
  if (typeof responseCode === 'number' && responseCode >= 500) {
    return new PermanentConsumerError(`SMTP ${responseCode}: ${detail}`);
  }

  // Сетевые/таймаутные сбои: SMTP временно недоступен → сообщение в очереди.
  if (
    typeof code === 'string' &&
    ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ESOCKET', 'ENOTFOUND', 'ECONNECTION'].includes(
      code,
    )
  ) {
    return new TransientConsumerError(`${code}: ${detail}`);
  }

  // Прочее (в т.ч. 4xx-ответы) — ретраи с backoff, затем DLQ.
  return error instanceof Error ? error : new Error(detail);
}
