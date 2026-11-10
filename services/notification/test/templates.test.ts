import { describe, expect, it } from 'vitest';
import { renderUserRegistered } from '../src/features/notify-user-registered/template';
import { renderSubmitted } from '../src/features/notify-appointment-submitted/template';
import {
  renderApproved,
  renderCancelled,
  renderDeclined,
} from '../src/features/notify-appointment-status/template';
import { renderRescheduled } from '../src/features/notify-appointment-rescheduled/template';
import { renderCompleted } from '../src/features/notify-appointment-completed/template';
import { renderDocumentUploaded } from '../src/features/notify-document-uploaded/template';
import type { AppointmentLetterData, PatientEmailInfo } from '../src/entities/mail';

const patient: PatientEmailInfo = {
  email: 'ivanov@test.mp',
  firstName: 'Иван',
  lastName: 'Иванов',
  middleName: 'Иванович',
  userId: 'u-1',
};

const appointment: AppointmentLetterData = {
  appointmentId: 'ap-1',
  patientId: 'pt-1',
  patientName: 'Иванов Иван Иванович',
  doctorId: 'doc-1',
  doctorName: 'Петров Пётр',
  specializationName: 'Хирург',
  slot: { localDate: '2026-11-10', start: '10:00', end: '10:30' },
};

/** Все письма этапа — на русском, тема непустая, адресат из карточки. */
const letters = [
  renderUserRegistered(patient.email),
  renderSubmitted(patient, appointment),
  renderApproved(patient, appointment),
  renderDeclined(patient, { ...appointment, reason: 'Врач заболел' }),
  renderCancelled(patient, appointment),
  renderRescheduled(patient, {
    appointmentId: 'ap-1',
    patientId: 'pt-1',
    previousStatus: 'APPROVED',
    old: {
      doctorName: 'Петров Пётр',
      specializationName: 'Хирург',
      slot: { localDate: '2026-11-10', start: '10:00', end: '10:30' },
    },
    new: {
      doctorName: 'Сидоров Сидор',
      specializationName: 'Кардиолог',
      slot: { localDate: '2026-11-12', start: '14:00', end: '14:30' },
    },
  }),
  renderCompleted(patient, appointment),
  renderDocumentUploaded(patient, {
    key: 'patient/pt-1/scan.pdf',
    ownerType: 'PATIENT',
    ownerId: 'pt-1',
    mime: 'application/pdf',
    size: 2048,
    category: 'Справка',
    uploadedBy: 'doctor-sub',
  }),
];

describe('шаблоны писем (6.2: локализация ru)', () => {
  it('каждое письмо имеет тему, текст и кириллицу; адресат — из карточки', () => {
    for (const letter of letters) {
      expect(letter.to, 'адресат').toBe(patient.email);
      expect(letter.subject.trim().length, 'тема непустая').toBeGreaterThan(0);
      expect(letter.text).toMatch(/[А-Яа-я]/); // кириллица (ru)
    }
  });

  it('письма о записи персонализируются ФИО пациента (приветствие — без ФИО: в payload его нет)', () => {
    for (const letter of letters.slice(1)) {
      expect(letter.text).toContain('Иванов Иван Иванович');
    }
    expect(letters[0].text).not.toContain('Иванов');
  });

  it('темы по спеке 6.2', () => {
    expect(letters[0].subject).toBe('Добро пожаловать в Медицинский портал');
    expect(letters[1].subject).toBe('Запись отправлена на подтверждение');
    expect(letters[2].subject).toBe('Запись подтверждена');
    expect(letters[3].subject).toBe('Запись отклонена');
    expect(letters[4].subject).toBe('Запись отменена');
    expect(letters[5].subject).toBe('Запись перенесена');
    expect(letters[6].subject).toBe('Приём завершён — результаты доступны');
    expect(letters[7].subject).toBe('Вам загружен документ: Справка');
  });

  it('детали записи: врач, специализация, слот в формате DD.MM.YYYY HH:mm–HH:mm', () => {
    expect(letters[1].text).toContain('Петров Пётр (Хирург)');
    expect(letters[1].text).toContain('10.11.2026 10:00–10:30');
  });

  it('отклонение содержит причину; без причины — без строки «Причина»', () => {
    expect(letters[3].text).toContain('Причина: Врач заболел');
    expect(renderDeclined(patient, appointment).text).not.toContain('Причина:');
  });

  it('перенос показывает новое и старое время (спека: новые дата/время и врач)', () => {
    expect(letters[5].text).toContain('12.11.2026 14:00–14:30');
    expect(letters[5].text).toContain('Сидоров Сидор (Кардиолог)');
    expect(letters[5].text).toContain('10.11.2026 10:00–10:30');
  });

  it('документ: категория в теме, размер в КБ в теле', () => {
    expect(letters[7].text).toContain('Справка');
    expect(letters[7].text).toContain('2 КБ');
  });
});
