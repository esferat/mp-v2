import type { AppointmentLetterData, Letter, PatientEmailInfo } from '../../entities/mail';
import { formatPatientName, formatSlot } from '../../shared/lib';

/** Шаблон «запись подтверждена» (6.2). */
export function renderApproved(patient: PatientEmailInfo, data: AppointmentLetterData): Letter {
  return {
    to: patient.email,
    subject: 'Запись подтверждена',
    text: [
      `Здравствуйте, ${formatPatientName(patient)}!`,
      '',
      `Ваша запись подтверждена: ${data.doctorName} (${data.specializationName}), ${formatSlot(data.slot)}.`,
      '',
      'Ждём вас на приёме.',
    ].join('\n'),
  };
}

/** Шаблон «запись отклонена» (6.2): причина — если врач её указал. */
export function renderDeclined(patient: PatientEmailInfo, data: AppointmentLetterData): Letter {
  return {
    to: patient.email,
    subject: 'Запись отклонена',
    text: [
      `Здравствуйте, ${formatPatientName(patient)}!`,
      '',
      `Ваша запись отклонена: ${data.doctorName} (${data.specializationName}), ${formatSlot(data.slot)}.`,
      ...(data.reason ? ['', `Причина: ${data.reason}`] : []),
      '',
      'Можно записаться на другое время.',
    ].join('\n'),
  };
}

/** Шаблон «запись отменена» (6.2). */
export function renderCancelled(patient: PatientEmailInfo, data: AppointmentLetterData): Letter {
  return {
    to: patient.email,
    subject: 'Запись отменена',
    text: [
      `Здравствуйте, ${formatPatientName(patient)}!`,
      '',
      `Ваша запись отменена: ${data.doctorName} (${data.specializationName}), ${formatSlot(data.slot)}.`,
      '',
      'Записаться снова можно в личном кабинете.',
    ].join('\n'),
  };
}
