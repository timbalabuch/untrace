import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['vendor/**', 'node_modules/**'] },
  js.configs.recommended,
  prettier,
  {
    // App code: browser ES modules (some are pure, but browser globals are harmless)
    files: ['js/**/*.js', 'fixtures/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, JSZip: 'readonly' },
    },
  },
  {
    // Tests run under Node's built-in test runner
    files: ['test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
];
