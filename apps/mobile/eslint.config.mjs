// إعداد ESLint 10 (flat config) — بديل عن eslint-config-expo الذي لا يدعم ESLint 10 بعد
import js from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import expo from 'eslint-plugin-expo';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { flatConfigs as importX } from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import { configs as tsConfigs } from 'typescript-eslint';

export default defineConfig([
  { ignores: ['dist/**', 'android/**', 'ios/**', '.expo/**', 'node_modules/**'] },
  js.configs.recommended,
  tsConfigs.recommended,
  importX.recommended,
  importX.typescript,
  importX['react-native'],
  eslintReact.configs['recommended-typescript'],
  reactHooks.configs.flat['recommended-latest'],
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx,mts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node, __DEV__: 'readonly' },
    },
    plugins: { expo },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver({ alwaysTryTypes: true })],
    },
    rules: {
      'expo/no-dynamic-env-var': 'error',
      'expo/no-env-var-destructuring': 'error',
      // مسارات مثل expo-router/js-tabs تُحلّ عبر exports في package.json
      'import-x/no-unresolved': ['error', { ignore: ['^expo-router/'] }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
    },
  },
  {
    // ملفات إعداد CommonJS
    files: ['**/*.cjs', 'app.config.js'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
]);
