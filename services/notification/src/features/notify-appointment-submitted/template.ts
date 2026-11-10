import type { AppointmentLetterData, Letter, PatientEmailInfo } from '../../entities/mail';
import { formatPatientName, formatSlot } from '../../shared/lib';

/** Шаблон «запись отправлена на подтверждение» (6.2). */
export function renderSubmitted(patient: PatientEmailInfo, data: AppointmentLetterData): Letter {
  return {
    to: patient.email,
    subject: 'Запись отправлена на подтверждение',
    text: [
      `Здравствуйте, ${formatPatientName(patient)}!`,
      '',
      `Ваша запись: ${data.doctorName} (${data.specializationName}), ${formatSlot(data.slot)}.`,
      '',
      'Отправлена на подтверждение — мы сообщим, когда врач подтвердит приём.',
    ].join('\n'),
  };
}
