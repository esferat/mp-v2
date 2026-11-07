import eslint from '@mp/eslint-config-fsd';

export default [
  ...eslint,
  {
    files: ['scripts/**/*.ts', 'test/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];
