import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { KcPage } from './kc.gen';
import './login/main.css';

/** Имя пометки глубокой ссылки (дублирует REGISTER_ACTION_PARAM витрины). */
const REGISTER_ACTION_PARAM = 'mp_action';
const REGISTER_ACTION_VALUE = 'register';

/**
 * Точка входа темы Keycloak. В проде FTL-шаблон кладёт в `window.kcContext`
 * контекст страницы (login/register/reset-password) — тогда рендерим её;
 * при открытии через `vite dev` контекста нет — показываем заглушку
 * (для полноценного превью страниц есть Storybook/mocks Keycloakify).
 *
 * Стили подключаются здесь (entry-чанк), чтобы таблица стилей попала в <head>
 * FTL-шаблона статически, без мигания нестилизованной страницы.
 */

const kcContext = window.kcContext;

/**
 * Глубокая ссылка на регистрацию (`/auth/register` витрины дописывает
 * mp_action=register в URL авторизации).
 *
 * Форма регистрации Keycloak доступна только из браузера, у которого уже есть
 * куки сессии (AUTH_SESSION_ID/KC_RESTART, иначе 400), — поэтому первый hop
 * обязателен. Как только страница загружена, перебрасываем на штатную
 * ссылку регистрации; страница входа при этом не рендерится (без «мигания»).
 */
const registerRedirect =
  kcContext?.pageId === 'login.ftl' &&
  new URLSearchParams(window.location.search).get(REGISTER_ACTION_PARAM) === REGISTER_ACTION_VALUE
    ? kcContext.url.registrationUrl
    : undefined;

if (registerRedirect) {
  window.location.replace(registerRedirect);
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {kcContext ? <KcPage kcContext={kcContext} /> : <h1>Нет контекста Keycloak</h1>}
    </StrictMode>,
  );
}
