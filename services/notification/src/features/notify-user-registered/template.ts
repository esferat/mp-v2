import type { Letter } from '../../entities/mail';

/**
 * Шаблон «приветствие» (6.2): после самостоятельной регистрации.
 * В payload только email (без ФИО) — письмо без персонализации по имени.
 */
export function renderUserRegistered(email: string): Letter {
  return {
    to: email,
    subject: 'Добро пожаловать в Медицинский портал',
    text: [
      'Вы зарегистрировались на медицинском портале.',
      '',
      'Войдите, чтобы записаться к врачу и управлять своими записями.',
    ].join('\n'),
  };
}
