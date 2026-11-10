import type { Letter, PatientEmailInfo } from '../../entities/mail';
import { formatDate, formatPatientName, formatSlot } from '../../shared/lib';

/** Данные письма «запись перенесена» (6.2): старый и новый слот с врачом. */
export interface RescheduledLetterData {
  appointmentId: string;
  patientId: string;
  previousStatus: string;
  old: {
    doctorName: string;
    specializationName: string;
    slot: { localDate: string; start: string; end: string };
  };
  new: {
    doctorName: string;
    specializationName: string;
    slot: { localDate: string; start: string; end: string };
  };
  /** Причина переноса (если указана). */
  reason?: string;
}

/**
 * Шаблон «запись перенесена» (6.2): новые дата/время и врач — по требованию
 * спеки; старые данные — для понимания, что именно изменилось.
 */
export function renderRescheduled(patient: PatientEmailInfo, data: RescheduledLetterData): Letter {
  return {
    to: patient.email,
    subject: 'Запись перенесена',
    text: [
      `Здравствуйте, ${formatPatientName(patient)}!`,
      '',
      'Ваша запись перенесена.',
      '',
      `Новое время: ${formatSlot(data.new.slot)}, врач ${data.new.doctorName} (${data.new.specializationName}).`,
      `Ранее: ${formatSlot(data.old.slot)}, врач ${data.old.doctorName} (${data.old.specializationName}).`,
      ...(data.reason ? ['', `Причина: ${data.reason}`] : []),
      '',
      `Дата записи: ${formatDate(data.new.slot.localDate)}.`,
    ].join('\n'),
  };
}
