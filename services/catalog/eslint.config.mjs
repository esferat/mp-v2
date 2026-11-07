import eslint from '@mp/eslint-config-fsd';

export default [
  ...eslint,
  {
    files: ['test/**/*.ts'],
    rules: {
      // Тесты подменяют порты in-memory-реализациями
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  {
    // Seed — CLI-скрипт, его вывод идёт в stdout, а не в логгер сервиса
    files: ['prisma/seed.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];
