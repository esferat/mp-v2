import eslint from '@mp/eslint-config-fsd';

export default [
  ...eslint,
  {
    files: ['test/**/*.ts'],
    rules: {
      // В тестах создаём фейки вместо реальных DI-контейнеров
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
];
