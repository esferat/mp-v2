/**
 * Общий ESLint-пресет mp-v2: границы Feature-Sliced Design (fsd.md §2, §8).
 *
 * Подключается во всех проектах (apps/*, services/*, packages/*):
 *   import fsd from '@mp/eslint-config-fsd';
 *   export default [...fsd, ...дополнительные правила проекта];
 *
 * Проверяемые правила (fsd.md §6):
 *  1. импорт «вверх» по слоям — запрещён;
 *  2. кросс-импорт соседних слайсов одного уровня — запрещён;
 *  3. глубокий импорт в чужой слайс (минуя index.ts) — запрещён;
 *  4. внешние пакеты и внутренние модули shared — разрешены по умолчанию.
 */
import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';

/** Слои FSD в порядке «сверху вниз» (fsd.md §2). */
export const FSD_LAYERS = [
  'app',
  'processes',
  'pages',
  'widgets',
  'features',
  'entities',
  'shared',
];

/**
 * Дескрипторы элементов для одного проекта.
 * @param {string} root — корень слоёв FSD относительно корня проекта ('src' или '')
 */
export function fsdElements(root = 'src') {
  const p = (name) => (root ? `${root}/${name}` : name);
  return [
    { type: 'app', pattern: p('app') },
    { type: 'processes', pattern: p('processes/*') },
    { type: 'pages', pattern: p('pages/*') },
    { type: 'widgets', pattern: p('widgets/*') },
    { type: 'features', pattern: p('features/*') },
    { type: 'entities', pattern: p('entities/*') },
    { type: 'shared', pattern: p('shared') },
  ];
}

/**
 * Политики зависимостей: default = allow, далее явные запреты.
 * @param {string} root
 */
function fsdPolicies() {
  /** Слои, лежащие ВЫШЕ слоя from — импорт в них запрещён. */
  const above = Object.fromEntries(
    FSD_LAYERS.map((layer, index) => [layer, FSD_LAYERS.slice(0, index)]),
  );
  // Оговорка fsd.md §4.2/§4.4: адаптеры `shared/api` реализуют порты из
  // `entities/repository` — это единственное разрешённое «вверх» направление.
  above.shared = above.shared.filter((layer) => layer !== 'entities');
  // fsd.md §4.2.4: «Общее — только в shared или через публичный API процесса»:
  // controller фичи (features) вызывает сценарий-сагу из processes/index.ts.
  // Углубление внутрь процесса остаётся запрещённым (правило deep-import).
  above.features = above.features.filter((layer) => layer !== 'processes');

  const upImportPolicies = FSD_LAYERS.map((layer) => ({
    from: { element: { type: layer } },
    disallow: { to: { element: { types: above[layer] } } },
    message:
      'Нарушение FSD: импорт «вверх» — "{{ from.element.path }}" (слой {{ from.element.type }}) → "{{ to.element.path }}" (слой {{ to.element.type }}).',
  }));

  /** Соседние слайсы одного уровня — только через вышестоящие слои. */
  const sameLayerPolicies = FSD_LAYERS.filter((l) => l !== 'shared').map((layer) => ({
    from: { element: { type: layer } },
    disallow: {
      to: { element: { type: layer, path: '!{{ from.element.path }}' } },
    },
    message:
      'Нарушение FSD: кросс-импорт слайса "{{ to.element.path }}" из "{{ from.element.path }}" — слайсы одного уровня не импортируют друг друга.',
  }));

  /** Глубокий импорт в чужой слайс: разрешён только его публичный API (index.ts). */
  const deepImportPolicy = {
    from: { element: { types: FSD_LAYERS } },
    disallow: {
      to: {
        element: {
          types: ['processes', 'pages', 'widgets', 'features', 'entities'],
          path: '!{{ from.element.path }}',
          internalPath: '!index.*',
        },
      },
    },
    message:
      'Нарушение FSD: импорт внутренностей слайса "{{ to.element.path }}" ({{ to.element.fileInternalPath }}) — используйте публичный API слайса (index.ts).',
  };

  return {
    default: 'allow',
    policies: [...upImportPolicies, ...sameLayerPolicies, deepImportPolicy],
  };
}

/**
 * @param {{ root?: string, react?: boolean, tsconfigRootDir?: string }} [options]
 */
export function createFsdConfig(options = {}) {
  const { root = 'src', react = false, tsconfigRootDir = process.cwd() } = options;

  return [
    {
      ignores: [
        '**/dist/**',
        '**/node_modules/**',
        '**/coverage/**',
        '**/.next/**',
        '**/*.d.ts',
        '**/src/generated/**',
        '**/openapi/**',
      ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
      languageOptions: {
        parserOptions: {
          // typescript-eslint v8.72: без явного tsconfigRootDir парсер выводит его
          // из стека конфигов и падает «multiple candidate TSConfigRootDirs», когда
          // один процесс eslint линтит файлы нескольких пакетов (lint-staged в
          // pre-commit моно-репозитория). Типизированных правил (project/
          // projectService) в пресете нет — достаточно стабильного абсолютного пути:
          // cwd вызова (корень пакета при `pnpm -r lint`, корень репо в хуке).
          tsconfigRootDir,
        },
      },
    },
    {
      plugins: { boundaries },
      settings: {
        'boundaries/elements': fsdElements(root),
        // Относительные импорты без расширения должны резолвиться в .ts-файлы,
        // иначе плагин не определит целевой элемент и не проверит политику.
        'import/resolver': {
          node: { extensions: ['.ts', '.tsx', '.js', '.jsx'] },
        },
      },
      rules: {
        ...boundaries.configs.recommended.rules,
        'boundaries/dependencies': [2, fsdPolicies()],
        // Усиления из fsd.md §7 (KISS/DRY)
        'no-console': ['warn', { allow: ['warn', 'error'] }],
      },
    },
    react
      ? {
          files: ['**/*.{tsx,jsx}'],
          rules: {
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off',
          },
        }
      : {},
    // e2e-скрипты (scripts/**) — Node-CLI без TS: глобалы окружения
    {
      files: ['scripts/**/*.mjs'],
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        globals: {
          process: 'readonly',
          console: 'readonly',
          fetch: 'readonly',
          URL: 'readonly',
          URLSearchParams: 'readonly',
          setTimeout: 'readonly',
          clearTimeout: 'readonly',
          setInterval: 'readonly',
          clearInterval: 'readonly',
        },
      },
      rules: {
        'no-console': 'off',
      },
    },
    prettier,
  ].filter(Boolean);
}

export default createFsdConfig();
