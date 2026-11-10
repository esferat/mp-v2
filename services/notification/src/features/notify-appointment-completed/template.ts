import type { Letter, PatientEmailInfo } from '../../entities/mail';
import { formatPatientName, formatSlot } from '../../shared/lib';
import type { AppointmentLetterData } from '../../entities/mail';

/** Шаблон «приём завершён — результаты доступны» (6.2). */
export function renderCompleted(patient: PatientEmailInfo, data: AppointmentLetterData): Letter {
  return {
    to: patient.email,
    subject: 'Приём завершён — результаты доступны',
    text: [
      `Здравствуйте, ${formatPatientName(patient)}!`,
      '',
      `Приём завершён: ${data.doctorName} (${data.specializationName}), ${formatSlot(data.slot)}.`,
      '',
      'Результаты приёма доступны в личном кабинете.',
    ].join('\n'),
  };
}
