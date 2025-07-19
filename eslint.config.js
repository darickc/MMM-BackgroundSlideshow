const globals = require('globals');
const {configs: eslintConfigs} = require('@eslint/js');
const eslintPluginImport = require('eslint-plugin-import');
const eslintPluginStylistic = require('@stylistic/eslint-plugin');

const config = [
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        EXIF: 'readonly',
        Log: 'readonly',
        Module: 'readonly',
        moment: 'readonly'
      }
    },
    plugins: {
      ...eslintPluginStylistic.configs.all.plugins,
      import: eslintPluginImport
    },
    rules: {
      ...eslintConfigs.all.rules,
      ...eslintPluginImport.configs.recommended.rules,
      ...eslintPluginStylistic.configs.all.rules,
      'capitalized-comments': 'off',
      complexity: ['error', 35],
      'consistent-this': 'off',
      curly: 'off',
      'id-length': 'off',
      'init-declarations': 'off',
      'line-comment-position': 'off',
      'max-lines': 'off',
      'max-lines-per-function': ['error', 150],
      'max-params': 'off',
      'max-statements': ['error', 100],
      'multiline-comment-style': 'off',
      'no-case-declarations': 'off',
      'no-continue': 'off',
      'no-global-assign': 'warn',
      'no-implicit-globals': 'warn',
      'no-inline-comments': 'off',
      'no-lonely-if': 'off',
      'no-magic-numbers': 'off',
      'no-param-reassign': 'off',
      'no-plusplus': 'off',
      'no-unused-vars': 'warn',
      'no-ternary': 'off',
      'no-warning-comments': 'off',
      'one-var': 'off',
      'sort-keys': 'off',
      '@stylistic/array-element-newline': ['error', 'consistent'],
      '@stylistic/comma-dangle': ['error', 'only-multiline'],
      '@stylistic/function-call-argument-newline': ['error', 'consistent'],
      '@stylistic/dot-location': ['error', 'property'],
      '@stylistic/indent': ['error', 2],
      '@stylistic/multiline-comment-style': 'off',
      '@stylistic/quote-props': ['error', 'as-needed'],
      '@stylistic/quotes': ['error', 'single'],
      '@stylistic/padded-blocks': ['error', 'never']
    }
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node
      },
      sourceType: 'module'
    },
    plugins: {
      ...eslintPluginStylistic.configs.all.plugins
    },
    rules: {
      ...eslintConfigs.all.rules,
      ...eslintPluginStylistic.configs.all.rules,
      'func-style': 'off',
      'max-lines-per-function': ['error', 100],
      'no-magic-numbers': 'off',
      'one-var': 'off',
      'prefer-destructuring': 'off'
    }
  }
];

module.exports = config;
