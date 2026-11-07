import jsxA11y from 'eslint-plugin-jsx-a11y';
import { createFsdConfig } from '@mp/eslint-config-fsd';

export default [
  ...createFsdConfig({ root: 'src', react: true }),

  // Доступность (2.2): ARIA/фокус/клавиатура — в CI через линт
  {
    ...jsxA11y.flatConfigs.recommended,
    files: ['src/**/*.tsx'],
  },

  // Задача 2.3 / fsd.md §6, №10: браузер не ходит в gateway напрямую —
  // весь fetch живёт в shared/api (клиент '/api/bff' или серверный инстанс).
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/shared/api/**', 'src/shared/config/auth-callbacks.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'fetch',
          message:
            'Нарушение 2.3 (fsd.md §6, №10): fetch — только через shared/api (браузер идёт в /api/bff).',
        },
      ],
    },
  },

  // Задача 2.2 / fsd.md §6, п.8: @mui импортируется ТОЛЬКО в shared/ui.
  // Проверяется намеренным нарушением — AC «прямой импорт блокируется линтом».
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/shared/ui/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@mui/material',
                '@mui/material/*',
                '@mui/icons-material',
                '@mui/icons-material/*',
                '@mui/x-date-pickers',
                '@mui/x-date-pickers/*',
                '@mui/material-nextjs',
                '@mui/material-nextjs/*',
                '@emotion/react',
                '@emotion/styled',
              ],
              message:
                'Нарушение 2.2 (fsd.md §6, п.8): импорт @mui/* — только через shared/ui (единый экспорт дизайн-системы).',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['test/**/*.ts', 'test/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
];
