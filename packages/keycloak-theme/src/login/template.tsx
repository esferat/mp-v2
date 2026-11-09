import { useEffect } from 'react';
import KcTemplate from 'keycloakify/login/Template';

/** Страница смены пароля (сброс по письму и принудительное обновление). */
const UPDATE_PASSWORD_PAGE = 'login-update-password.ftl';

/** Идентификатор формы на этой странице (keycloakify: LoginUpdatePassword). */
const FORM_ID = 'kc-passwd-update-form';

/**
 * Принудительный выход из остальных сессий при смене пароля — AC 1.5
 * «после сброса — logout всех сессий пользователя».
 *
 * Почему принудительно, а не чекбоксом: Keycloak завершает остальные сессии
 * ТОЛЬКО при параметре `logout-sessions=on` (проверено e2e `scripts/
 * e2e-reset-password.mjs`: без него introspection старого токена остаётся
 * `active=true`, с ним — `active=false`). Исходный чекбокс «Выйти из всех
 * остальных сессий?» поэтому прячем стилями (login/main.css), чтобы поведение
 * не выглядело отменяемым.
 *
 * Чистая функция (DOM-логика вынесена ради юнит-теста, см. template.test.ts).
 */
export function syncForcedLogoutInput(doc: Document, pageId: string): void {
  if (pageId !== UPDATE_PASSWORD_PAGE) return;
  const form = doc.getElementById(FORM_ID) ?? doc.querySelector('form');
  if (!form) return;
  // идемпотентно: скрытое поле добавляем ровно один раз
  if (form.querySelector('input[name="logout-sessions"][type="hidden"]')) return;

  const hidden = doc.createElement('input');
  hidden.type = 'hidden';
  hidden.name = 'logout-sessions';
  hidden.value = 'on';
  form.appendChild(hidden);
}

/**
 * Обёртка штатного шаблона Keycloakify: добавляет скрытое поле (см. выше).
 *
 * Эффект без списка зависимостей: шаблон первым рендером отдаёт null (ждёт
 * готовности стилей), поэтому проверка выполняется после каждого коммита —
 * поле появляется, как только отрисовалась форма, и больше не трогается.
 */
export function TemplateWithForcedLogout(
  props: React.ComponentProps<typeof KcTemplate>,
): React.JSX.Element {
  const { kcContext } = props;

  useEffect(() => {
    syncForcedLogoutInput(document, kcContext.pageId);
  });

  return <KcTemplate {...props} />;
}
