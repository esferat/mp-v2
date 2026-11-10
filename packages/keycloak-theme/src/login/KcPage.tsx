import { lazy, Suspense } from 'react';
import type { ClassKey } from 'keycloakify/login';
import type { KcContext } from './KcContext';
import { useI18n } from './i18n';
import DefaultPage from 'keycloakify/login/DefaultPage';
import { TemplateWithForcedLogout } from './template';

const UserProfileFormFields = lazy(() => import('keycloakify/login/UserProfileFormFields'));

/** Подтверждение пароля на регистрации — как в родном шаблоне Keycloak. */
const doMakeUserConfirmPassword = true;

/**
 * Контейнер страниц Keycloak (вход / регистрация / сброс пароля).
 *
 * `DefaultPage` сам маршрутизирует по `kcContext.pageId` на дефолтные
 * страницы Keycloakify — вся логика (action формы, ссылки «Регистрация»,
 * «Забыли пароль?», i18n) остаётся штатной.
 *
 * `doUseDefaultCss = false` — подложка PatternFly НЕ подключается: в
 * Keycloak 26.2 её пути (`${resourcesCommonPath}/node_modules/@patternfly/…`)
 * отдают 404, из-за чего страница может вовсе не отрисоваться (Template ждёт
 * загрузки таблиц стилей). Вместо этого визуал целиком задаёт наш
 * `src/login/main.css` по семантическим классам `kc*Class` (kcClsx всегда
 * возвращает имя ключа) и стабильным id (`#kc-header`, `#kc-content`, …).
 */
export default function KcPage(props: { kcContext: KcContext }) {
  const { kcContext } = props;

  const { i18n } = useI18n({ kcContext });

  return (
    <Suspense>
      <DefaultPage
        kcContext={kcContext}
        i18n={i18n}
        classes={classes}
        Template={TemplateWithForcedLogout}
        doUseDefaultCss={false}
        UserProfileFormFields={UserProfileFormFields}
        doMakeUserConfirmPassword={doMakeUserConfirmPassword}
      />
    </Suspense>
  );
}

/** Переопределения классов не нужны: стилизуем сами ключи `kc*Class`. */
const classes = {} satisfies { [key in ClassKey]?: string };
