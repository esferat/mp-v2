import { describe, expect, it } from 'vitest';
import { isSkipped, parseSkipList, sendLetter, sendPatientLetter } from '../src/entities/mail';
import { formatDate, formatPatientName, formatSlot } from '../src/shared/lib';

const patient = {
  email: 'ivanov@test.mp',
  firstName: 'Иван',
  lastName: 'Иванов',
  middleName: 'Иванович',
  userId: 'u-1',
};

const mail = {
  sent: [] as { to: string; subject: string }[],
  async send(letter: { to: string; subject: string }) {
    this.sent.push({ to: letter.to, subject: letter.subject });
  },
};

const deps = { mail, patients: { findById: async () => patient }, skip: [] as string[] };

describe('skip-whitelist (6.2: env NOTIFY_SKIP_RECIPIENTS)', () => {
  it('парсит список через запятую, игнорирует пустые и регистр', () => {
    expect(parseSkipList(' @Test.mp , bot@example.com ,, ')).toEqual([
      '@test.mp',
      'bot@example.com',
    ]);
  });

  it('матчит точный адрес и домен', () => {
    expect(isSkipped('bot@example.com', ['bot@example.com'])).toBe(true);
    expect(isSkipped('Ivanov@Test.mp', ['@test.mp'])).toBe(true);
    expect(isSkipped('ivanov@other.mp', ['@test.mp', 'bot@example.com'])).toBe(false);
  });

  it('письмо на адрес из whitelist пропускается, остальные отправляются', async () => {
    const skipDeps = { ...deps, skip: parseSkipList('@test.mp') };

    expect(await sendLetter(skipDeps, { to: 'a@other.mp', subject: 'S', text: 't' })).toBe('sent');
    expect(await sendLetter(skipDeps, { to: 'b@test.mp', subject: 'S', text: 't' })).toBe(
      'skipped',
    );
    expect(mail.sent.map((l) => l.to)).toEqual(['a@other.mp']);
  });
});

describe('sendPatientLetter (6.2: адресация)', () => {
  it('резолвит email по patientId и отправляет', async () => {
    const outcome = await sendPatientLetter(deps, 'pt-1', (p) => ({
      to: p.email,
      subject: 'Тема',
      text: 'Текст',
    }));

    expect(outcome).toBe('sent');
    expect(mail.sent.at(-1)).toEqual({ to: 'ivanov@test.mp', subject: 'Тема' });
  });

  it('нет карточки пациента → no-recipient, письмо не уходит', async () => {
    const outcome = await sendPatientLetter(
      { ...deps, patients: { findById: async () => null } },
      'pt-404',
      (p) => ({ to: p.email, subject: 'S', text: 't' }),
    );

    expect(outcome).toBe('no-recipient');
  });

  it('загрузил не он сам: uploadedBy ≠ userId владельца → отправляем', async () => {
    const outcome = await sendPatientLetter(
      deps,
      'pt-1',
      (p) => ({ to: p.email, subject: 'S', text: 't' }),
      { uploadedBy: 'doctor-sub' },
    );

    expect(outcome).toBe('sent');
  });

  it('загрузил он сам: uploadedBy = userId владельца → пропуск', async () => {
    const outcome = await sendPatientLetter(
      deps,
      'pt-1',
      (p) => ({ to: p.email, subject: 'S', text: 't' }),
      { uploadedBy: 'u-1' },
    );

    expect(outcome).toBe('skipped');
  });
});

describe('форматирование писем (ru)', () => {
  it('дата YYYY-MM-DD → DD.MM.YYYY', () => {
    expect(formatDate('2026-11-10')).toBe('10.11.2026');
  });

  it('слот → «дата начало–конец»', () => {
    expect(formatSlot({ localDate: '2026-11-10', start: '10:00', end: '10:30' })).toBe(
      '10.11.2026 10:00–10:30',
    );
  });

  it('ФИО в порядке «Фамилия Имя Отчество», без пустых частей', () => {
    expect(formatPatientName(patient)).toBe('Иванов Иван Иванович');
    expect(formatPatientName({ firstName: 'Иван', lastName: 'Иванов' })).toBe('Иванов Иван');
  });
});
