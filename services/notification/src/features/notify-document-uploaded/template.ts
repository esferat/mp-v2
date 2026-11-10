import type { Letter, PatientEmailInfo } from '../../entities/mail';
import { formatPatientName } from '../../shared/lib';

/** Данные письма о загрузке документа (6.2). */
export interface DocumentUploadedLetterData {
  key: string;
  ownerType: string;
  ownerId: string;
  mime: string;
  size: number;
  category?: string;
  uploadedBy: string;
}

/**
 * Шаблон «вам загружен документ» (6.2). Категория — если файл загружен
 * в конкретную категорию; иначе обобщённое «документ».
 */
export function renderDocumentUploaded(
  owner: PatientEmailInfo,
  data: DocumentUploadedLetterData,
): Letter {
  const subject = data.category
    ? `Вам загружен документ: ${data.category}`
    : 'Вам загружен документ';
  return {
    to: owner.email,
    subject,
    text: [
      `Здравствуйте, ${formatPatientName(owner)}!`,
      '',
      `Вам загружен документ${data.category ? ` (${data.category})` : ''}.`,
      `Файл: ${data.key} (${data.mime}, ${Math.round(data.size / 1024)} КБ).`,
      '',
      'Он доступен в личном кабинете.',
    ].join('\n'),
  };
}
