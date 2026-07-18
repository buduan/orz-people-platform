import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import vuePlugin from 'eslint-plugin-vue';
import globals from 'globals';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import vueParser from 'vue-eslint-parser';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({
  baseDirectory: currentDirectory,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: [
      '**/dist/**',
      '**/.nuxt/**',
      '**/.output/**',
      '.agents/**',
      '.codex/**',
      '**/node_modules/**',
      'scripts/**/*.mjs',
      'eslint.config.mjs',
    ],
  },
  js.configs.recommended,
  ...compat.extends('airbnb-base', 'airbnb-typescript/base'),
  ...vuePlugin.configs['flat/recommended'],
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.node,
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: currentDirectory,
      },
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.eslint.json',
        },
      },
    },
  },
  {
    files: ['app/frontend/**/*.vue'],
    languageOptions: {
      globals: globals.browser,
      parser: vueParser,
      parserOptions: {
        extraFileExtensions: ['.vue'],
        parser: tsParser,
        project: null,
      },
    },
    rules: {
      // Nuxt generates the SFC project at runtime; avoid requiring it for linting.
      '@typescript-eslint/dot-notation': 'off',
      '@typescript-eslint/no-implied-eval': 'off',
      '@typescript-eslint/no-throw-literal': 'off',
      '@typescript-eslint/return-await': 'off',
      // Vue templates consume bindings declared in <script setup>.
      '@typescript-eslint/no-unused-vars': 'off',
      'vue/multi-word-component-names': 'off',
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.eslint.json',
        },
      },
    },
  },
  {
    files: ['app/frontend/**/*.{ts,vue}'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['**/*.{ts,vue}'],
    rules: {
      // Nest modules and package barrel files deliberately use named exports.
      'class-methods-use-this': 'off',
      'import/prefer-default-export': 'off',
    },
  },
];
