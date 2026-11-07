import fsd from '@mp/eslint-config-fsd';

/**
 * Корневой конфиг (конфиги, скрипты, инфраструктура).
 * Проекты подключают пресет сами через свои eslint.config.mjs.
 */
export default [
  ...fsd,
  {
    files: ['**/*.{js,mjs,cjs}'],
    rules: {
      'no-console': 'off',
    },
  },
];
