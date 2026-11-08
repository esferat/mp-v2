/* eslint-disable @typescript-eslint/no-unused-vars */
import { i18nBuilder } from 'keycloakify/login';
import type { ThemeName } from '../kc.gen';

/**
 * Переводы страниц Keycloak (i18n Keycloakify): базовый набор сообщений +
 * имя темы для переопределений.
 * @see https://docs.keycloakify.dev/features/i18n
 *
 * NB: в русском наборе Keycloakify нет пяти ключей, которые используют страницы
 * входа/регистрации/сброса пароля, — без переопределения они отдаются
 * по-английски («Register», «*Required fields», aria-label кнопки показа пароля
 * и подсказка перезапуска входа). Ключи есть в базовом (en) наборе, поэтому
 * добавляем только ru: тип `msg` не меняется (union не растёт) и дефолтные
 * страницы Keycloakify компилируются как обычно.
 */
const { useI18n, ofTypeI18n } = i18nBuilder
  .withThemeName<ThemeName>()
  .withCustomTranslations({
    ru: {
      registerTitle: 'Регистрация',
      requiredFields: 'Обязательные поля',
      showPassword: 'Показать пароль',
      hidePassword: 'Скрыть пароль',
      restartLoginTooltip: 'Начать вход заново',
    },
  })
  .build();

type I18n = typeof ofTypeI18n;

export { useI18n, type I18n };
