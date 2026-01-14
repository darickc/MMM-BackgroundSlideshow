import css from '@eslint/css';
import {defineConfig} from 'eslint/config';
import globals from 'globals';
import {flatConfigs as importX} from 'eslint-plugin-import-x';
import js from '@eslint/js';
import markdown from '@eslint/markdown';
import stylistic from '@stylistic/eslint-plugin';

export default defineConfig([
  {
    'files': ['**/*.css'],
    'languageOptions': {'tolerant': true},
    'plugins': {css},
    'language': 'css/css',
    'extends': ['css/recommended'],
    'rules': {'css/use-baseline': ['error', {'available': 'newly'}]}
  },
  {
    'files': ['**/*.js'],
    'languageOptions': {
      'globals': {
        ...globals.browser,
        ...globals.node,
        'EXIF': 'readonly',
        'Log': 'readonly',
        'Module': 'readonly',
        'moment': 'readonly'
      }
    },
    'plugins': {js,
      stylistic},
    'extends': [importX.recommended, 'js/all', 'stylistic/all'],
    'rules': {
      '@stylistic/array-element-newline': ['error', 'consistent'],
      '@stylistic/comma-dangle': ['error', 'only-multiline'],
      '@stylistic/function-call-argument-newline': ['error', 'consistent'],
      '@stylistic/dot-location': ['error', 'property'],
      '@stylistic/indent': ['error', 2],
      '@stylistic/multiline-comment-style': 'off',
      '@stylistic/quote-props': ['error', 'as-needed'],
      '@stylistic/quotes': ['error', 'single'],
      '@stylistic/padded-blocks': ['error', 'never'],
      'capitalized-comments': 'off',
      'complexity': ['error', 35],
      'consistent-this': 'off',
      'curly': 'off',
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
      'no-ternary': 'off',
      'no-warning-comments': 'off',
      'one-var': ['error', 'never'],
      'sort-keys': 'off'
    }
  },
  {
    'files': ['**/*.mjs'],
    'languageOptions': {
      'ecmaVersion': 'latest',
      'globals': {
        ...globals.node
      },
      'sourceType': 'module'
    },
    'plugins': {js,
      stylistic},
    'extends': [importX.recommended, 'js/all', 'stylistic/all'],
    'rules': {
      '@stylistic/array-element-newline': ['error', 'consistent'],
      '@stylistic/quotes': ['error', 'single'],
      '@stylistic/indent': ['error', 2],
      '@stylistic/object-property-newline': ['error', {'allowAllPropertiesOnSameLine': true}],
      'func-style': 'off',
      'max-lines-per-function': ['error', 100],
      'no-magic-numbers': 'off',
      'one-var': 'off',
      'sort-keys': 'off'
    }
  },
  {
    'files': ['**/*.md'],
    'plugins': {markdown},
    'extends': ['markdown/recommended'],
    'language': 'markdown/gfm'
  }
]);
