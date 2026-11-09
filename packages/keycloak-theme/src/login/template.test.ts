import { beforeEach, describe, expect, it } from 'vitest';
import { syncForcedLogoutInput } from './template';

/**
 * AC 1.5 «после сброса пароля — принудительный logout всех сессий»:
 * на странице смены пароля в форму добавляется logout-sessions=on
 * (см. src/login/template.tsx; Flow Keycloak проверен e2e-скриптом).
 */
describe('syncForcedLogoutInput (принудительный logout сессий, AC 1.5)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function mountForm(): HTMLFormElement {
    const form = document.createElement('form');
    form.id = 'kc-passwd-update-form';
    form.innerHTML =
      '<input name="password-new" type="password">' +
      '<input name="password-confirm" type="password">' +
      '<input name="logout-sessions" type="checkbox" value="on">';
    document.body.append(form);
    return form;
  }

  const hiddenOf = (form: HTMLFormElement): HTMLInputElement | null =>
    form.querySelector('input[name="logout-sessions"][type="hidden"]');

  it('на странице смены пароля добавляет скрытое поле', () => {
    const form = mountForm();

    syncForcedLogoutInput(document, 'login-update-password.ftl');

    const hidden = hiddenOf(form);
    expect(hidden).not.toBeNull();
    expect(hidden?.value).toBe('on');
    // исходный чекбокс не трогаем (он скрыт стилями, но остаётся в разметке)
    expect(form.querySelectorAll('input[name="logout-sessions"]')).toHaveLength(2);
  });

  it('повторные вызовы идемпотентны (поле не дублируется)', () => {
    const form = mountForm();

    syncForcedLogoutInput(document, 'login-update-password.ftl');
    syncForcedLogoutInput(document, 'login-update-password.ftl');

    expect(form.querySelectorAll('input[name="logout-sessions"][type="hidden"]')).toHaveLength(1);
  });

  it('на других страницах ничего не добавляет', () => {
    const form = mountForm();

    syncForcedLogoutInput(document, 'login.ftl');
    syncForcedLogoutInput(document, 'register.ftl');

    expect(hiddenOf(form)).toBeNull();
  });

  it('отсутствие формы не роняет страницу (шаблон первым рендером отдаёт null)', () => {
    expect(() => syncForcedLogoutInput(document, 'login-update-password.ftl')).not.toThrow();
  });
});
