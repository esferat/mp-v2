# mp-ui-kit

Дизайн-система и библиотека компонентов на базе **Material UI (MUI v7—v9, проверено на v9)**:
дизайн-токены → тема MUI → переиспользуемые React-компоненты → документация в Storybook.

Цветовая схема — **медицинская (бирюзовый бренд, primary `#0D9488`)**, отступы — **компактные**
(плотный админ-интерфейс; Этап 1, [`docs/new-project/roadmap.md`](../../docs/new-project/roadmap.md)).

> **Расположение:** пакет живёт в монорепо `mp-v2` (`packages/mp-ui-kit/`, npm-имя — `mp-ui-kit`).
> Потребитель внутри монорепо — `apps/web` (зависимость `workspace:*`); UI-функционал строится
> на компонентах `Mp*`, недостающий компонент добавляется сюда (компонент + Storybook-история + тест).

- **React 19 + TypeScript + Vite** — сборка библиотеки в ESM/CJS с типами
- **MUI v7—v9** как peer-зависимость — версии остаются под контролем приложения-потребителя
- **Storybook 10** — каталог компонентов, автодоки, проверка доступности (a11y), переключатель светлой/тёмной темы
- **Тёмная тема** из коробки: один проп `mode` у провайдера

## Установка

### В монорепо mp-v2 (основной путь)

Подключено в `apps/web` как workspace-зависимость:

```jsonc
// apps/web/package.json
"dependencies": {
  "mp-ui-kit": "workspace:*"
}
```

Перед typecheck/сборкой потребителя нужен собранный `dist` (типы): `pnpm --filter mp-ui-kit build`
— выполняется автоматически корневыми `pnpm typecheck` и `pnpm build`, а также в Dockerfile
`apps/web`. Storybook в разработке — `pnpm --filter mp-ui-kit dev` (http://localhost:6006).

### Внешний потребитель (вне монорепо)

```bash
npm install mp-ui-kit @mui/material @emotion/react @emotion/styled @mui/x-date-pickers date-fns react react-dom
```

либо тарболл (для локальной установки; `prepack` сам запускает typecheck + build):

```bash
cd packages/mp-ui-kit && pnpm run pack:dist      # создаёт mp-ui-kit-<версия>.tgz
npm install ./packages/mp-ui-kit/mp-ui-kit-0.1.0.tgz
```

Все peer-зависимости (MUI, Emotion, `date-fns`, React) остаются **внешними** —
версии всегда под контролем приложения-потребителя.

При изменении компонентов пересобирайте пакет (`pnpm --filter mp-ui-kit build`,
либо `pnpm --filter mp-ui-kit dev` для Storybook). Версию поднимайте в
`packages/mp-ui-kit/package.json` — тарболл подхватит её автоматически.

## Быстрый старт

```tsx
import { MpThemeProvider, MpButton, MpTextField, MpAlert, MpDateProvider } from 'mp-ui-kit';

export function App() {
  return (
    <MpThemeProvider mode="light">
      <MpTextField label="Электронная почта" placeholder="user@example.com" />
      <MpButton variant="contained" loading>
        Сохранить
      </MpButton>
      <MpAlert title="Готово" severity="success">
        Данные сохранены.
      </MpAlert>
      {/* Провайдер локали — один раз на всё приложение, нужен для MpDatePicker */}
      <MpDateProvider>
        <MpDatePicker label="Дата записи" value={date} onChange={setDate} />
      </MpDateProvider>
    </MpThemeProvider>
  );
}
```

Тёмная тема:

```tsx
<MpThemeProvider mode="dark">...</MpThemeProvider>
```

## Компоненты

### Базовые

| Компонент     | Описание                                                                    |
| ------------- | --------------------------------------------------------------------------- |
| `MpButton`    | Кнопка: варианты `contained/outlined/text`, цвета, размеры, `loading`       |
| `MpTextField` | Поле ввода: `label`, `helperText`, `error`, `startAdornment`/`endAdornment` |
| `MpAlert`     | Уведомление: `severity`, `variant`, `title`, `action`                       |
| `MpChip`      | Тег/фильтр: цвета палитры (`brand`, `neutral` включительно), `onDelete`     |
| `MpBadge`     | Счётчик: `badgeContent`, `max`, `variant="dot"`                             |
| `MpAvatar`    | Аватар: размеры `xs…xl`, инициалы из `name`                                 |
| `MpCard`      | Карточка: `variant="elevated                                                | outlined | flat"`+`MpCardContent`, `MpCardActions` |

### Формы и выбор (Этап 1, §2.2)

| Компонент           | Описание                                                                         |
| ------------------- | -------------------------------------------------------------------------------- |
| `MpSelect`          | Выпадающий список: `label`, `options`, `placeholder`, `helperText`, `error`      |
| `MpAutocomplete`    | Автокомплит: поиск по списку, `label`, `loading`, `error`                        |
| `MpDatePicker`      | Поле даты (`dd.MM.yyyy`, ru-локаль), требует `MpDateProvider`                    |
| `MpDateRangePicker` | Диапазон дат из двух `DatePicker` («С» — «По») с ограничением границ             |
| `MpDateProvider`    | `LocalizationProvider` + `AdapterDateFns` + локаль `ru` — один раз на приложение |

### Таблицы, окна и обратная связь

| Компонент                                                | Описание                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| `MpTable` + `MpTableContainer/Head/Row/Body/Footer/Cell` | Таблица: `MpTableCell head` рендерит `<th scope="col">`                  |
| `MpTablePagination`                                      | Пагинация: подписи по-русски, шаги `10/25/50`, первая/последняя страница |
| `MpDialog` + `MpDialogContent/Actions`                   | Модальное окно: `title`, подтверждения, формы                            |
| `MpSnackbar`                                             | Тосты: `severity` (Alert) или простой тост, `action` («Повторить»)       |
| `MpSkeleton`                                             | Скелетон: `lines={n}` — стопка строк, варианты MUI                       |
| `MpSpinner`                                              | Центрированный спиннер с подписью `label`                                |
| `MpStatusBadge` + `mpStatuses`                           | Бейдж статуса: цвет и подпись из реестра статусов                        |
| `MpEmptyState`                                           | Пустое состояние: иконка + заголовок + описание + действие               |

### Оболочка приложения (`../../docs/new-project/design/layout.md`)

| Компонент      | Описание                                                                                                                                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MpAppShell`   | Единая оболочка: шапка + меню + заголовок страницы + контент. `menu` через пропсы, `logo`, `title`/`subtitle`/`headerActions`, `pageTitle`/`pageSubtitle`/`pageActions`, `mini`/`defaultMini`/`onMiniChange`, `drawerVariant` |
| `MpAppBar`     | Шапка 64px: `logo`, `title`, `subtitle`, гамбургер `onMenuClick`, `actions`                                                                                                                                                   |
| `MpNavDrawer`  | Боковое меню 240px / свёрнутое 72px (`mini`, тултипы), `selectedId`, `onSelect`, кнопка свернуть/развернуть внизу `onToggleCollapse`                                                                                          |
| `MpPageHeader` | Заголовок страницы 72px: `title`, `subtitle`, `actions`, слот под фильтры                                                                                                                                                     |

### Статусы

`mpStatuses` — реестр цветов и подписей по макетам (`../../docs/new-project/design/`: `appointments.md`, `doctors-list.md`, `history.md`):

| Группа            | Статусы                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Запись            | `SUBMITTED` (жёлтый) · `APPROVED` (зелёный) · `DECLINED` (красный) · `CANCELLED` (серый) |
| Врач              | `ACTIVE` · `INACTIVE`                                                                    |
| Слоты и состояния | `AVAILABLE` · `BOOKED` · `NEW` · `PENDING` · `CONFIRMED` · `COMPLETED` · `FAILED`        |

```tsx
<MpStatusBadge status="SUBMITTED" />   // ⧗ В ожидании
<MpStatusBadge status="APPROVED" variant="outlined" />
```

Все компоненты — тонкие обёртки над MUI: сохраняют полный API базового компонента,
добавляют решения дизайн-системы (скругления, вес шрифта, поведение по умолчанию)
и типизированные расширения темы. Импорт — из одной точки: `import { ... } from 'mp-ui-kit'`.

## Тема и токены

```ts
import { createMpTheme, mpTokens, useMpTheme } from 'mp-ui-kit';

const theme = createMpTheme({ mode: 'dark' });
```

Токены (`src/theme/tokens.ts`):

- **brand** — бирюзовая шкала 50…900 (teal), primary = `brand[600] #0D9488`; secondary — синий `#2563EB`
- **neutral** — нейтральная шкала slate 50…900
- **semantic** — success, warning, error, info (+ soft-фоны `light`)
- **surfaces** — фоны/текст/разделители для светлой и тёмной схем
- **typography** — шрифтовой стек Inter, веса, шкала `display, h1…h6, body, caption, overline`
- **spacing** — компактная шкала `xs 2 · sm 4 · md 8 · lg 12 · xl 16 · xxl 24`
- **radius** — `xs 2 · sm 4 · md 8 · lg 12 · xl 16 · xxl 24 · full`
- **shadow** — уровни `sm/md/lg/xl` отдельно для светлой и тёмной схемы
- **motion** — длительности и кривые easing
- **controlHeight** — `sm 24 · md 32 · lg 40`; **avatarSize** — `xs 20 … xl 64`
- **layout** — размеры оболочки: `header 64 · pageTitle 72 · sidebar 240 · sidebarMini 72`

Тема дополнительно уплотняет компоненты MUI: высоты кнопок/полей, отступы ячеек
таблицы, пунктов меню, строк диалога — компактные по умолчанию.

Собственные цвета `brand` и `neutral` регистрируются в палитре MUI через module
augmentation (`src/theme/augmentation.ts`) и доступны в пропсах:
`<MpButton color="neutral">`, `<MpChip color="brand">`, `<MpBadge color="neutral">`.

Дизайн-токены — только через тему MUI: в компонентах используются ссылки на `theme.*`,
без «магических» цветов (`../../docs/new-project/functional-spec.md`, §2.2).

## Скрипты

| Команда                                   | Назначение                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `pnpm run storybook` (или `pnpm run dev`) | Дев-сервер Storybook на http://localhost:6006                                                  |
| `pnpm run build`                          | Сборка библиотеки: `dist/mp-ui-kit.js`, `dist/mp-ui-kit.cjs` + `.d.ts`                         |
| `pnpm run build-storybook`                | Статика Storybook в `storybook-static/`                                                        |
| `pnpm run typecheck`                      | Проверка типов                                                                                 |
| `pnpm test`                               | Тесты историй Storybook (vitest + playwright; требует `pnpm exec playwright install chromium`) |
| `pnpm test:watch`                         | Те же тесты в watch-режиме                                                                     |
| `pnpm run clean`                          | Удалить `dist/` и `storybook-static/`                                                          |

## Структура

```
mp-ui-kit/
├── .storybook/           # конфиг Storybook: main.ts, preview.tsx (тема + тулбар)
├── src/
│   ├── components/       # Button, TextField, Alert, Chip, Badge, Avatar, Card,
│   │   └── <Name>/       #   Select, Autocomplete, Table, Dialog, Snackbar, Skeleton,
│   │                     #   Spinner, StatusBadge, EmptyState, DatePicker, AppShell
│   │                     #   → Mp<Name>.tsx + Mp<Name>.stories.tsx
│   ├── docs/             # страницы документации: Introduction, Foundations
│   ├── theme/            # tokens.ts, createTheme.ts, ThemeProvider.tsx, augmentation.ts
│   └── index.ts          # точка входа библиотеки
├── vite.config.ts        # сборка библиотеки (ESM + CJS, внешние peer-зависимости)
├── tsconfig.json         # типы для разработки и Storybook
└── tsconfig.build.json   # генерация .d.ts в dist/types
```

## Документация

`pnpm run storybook` → разделы:

- **Introduction** — установка, быстрый старт, состав
- **Foundations** — цвета, типографика, скругления, отступы, тени
- **Components/\*** — страница каждого компонента: автодоки, контролы, примеры
  (варианты, размеры, состояния, loading, тёмная тема через тулбар «Тема»)
- **Shell/AppShell** — оболочка `MpAppShell`: логотип, меню через пропсы,
  кнопка свернуть/развернуть боковую панель, заголовок страницы

## Планы

- CSS-переменные темы (тёмная тема без пересоздания объекта темы)
- Визуальные (chromatic) и unit-тесты компонентов
- Публикация в npm и автоматизация релизов
