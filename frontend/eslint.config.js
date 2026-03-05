import js from '@eslint/js'
import pluginOxlint from 'eslint-plugin-oxlint'
import pluginUnicorn from 'eslint-plugin-unicorn'
import pluginVue from 'eslint-plugin-vue'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'

export default defineConfig([
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,js,mjs,jsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],

  {
    plugins: {
      unicorn: pluginUnicorn,
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { varsIgnorePattern: '_' }],
      'vue/component-definition-name-casing': ['error', 'PascalCase'],
      'vue/no-unused-vars': 'warn',
      'vue/multi-word-component-names': 'off',
      'vue/no-reserved-component-names': 'off',
      'vue/comment-directive': 'off',
      'no-console':
        globalThis.process?.env?.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger':
        globalThis.process?.env?.NODE_ENV === 'production' ? 'warn' : 'off',
      'linebreak-style': 'off',
      'implicit-arrow-linebreak': 'off',
      'function-paren-newline': 'off',
      'operator-linebreak': 'off',
      'object-curly-newline': [
        'error',
        {
          ObjectExpression: {
            consistent: true,
            multiline: true,
          },
          ObjectPattern: {
            consistent: true,
            multiline: true,
          },
          ImportDeclaration: {
            consistent: true,
            multiline: true,
          },
          ExportDeclaration: {
            multiline: true,
            minProperties: 3,
          },
        },
      ],
      'no-shadow': 'off',
      'space-before-function-paren': 'off',
      'max-len': [
        'error',
        {
          code: 200,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
          ignorePattern: '^\\s*<.*>$',
        },
      ],
      curly: ['error', 'all'],
      indent: [
        'error',
        2,
        {
          SwitchCase: 1,
        },
      ],
      'vue/arrow-spacing': 'error',
      'vue/attributes-order': [
        'error',
        {
          order: [
            'DEFINITION',
            'LIST_RENDERING',
            'CONDITIONALS',
            'RENDER_MODIFIERS',
            'GLOBAL',
            ['UNIQUE', 'SLOT'],
            'TWO_WAY_BINDING',
            'OTHER_DIRECTIVES',
            'OTHER_ATTR',
            'EVENTS',
            'CONTENT',
          ],
          alphabetical: false,
        },
      ],
      'vue/eqeqeq': ['error', 'always'],
      'vue/html-self-closing': 'error',
      'vue/order-in-components': [
        'error',
        {
          order: [
            'props',
            'data',
            'lifecycle',
            'watch',
            'computed',
            'methods',
            'render',
          ],
        },
      ],
      'vue/require-default-prop': 'error',
      'vue/require-prop-types': 'error',
      'vue/this-in-template': 'error',
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      'vue/no-duplicate-attr-inheritance': 'error',
      'vue/v-on-style': ['error', 'shorthand'],
      'vue/no-multi-spaces': 'error',
      'vue/padding-line-between-blocks': 'error',
      'vue/v-bind-style': 'error',
      'vue/v-slot-style': ['error', 'shorthand'],
      'vue/prop-name-casing': ['error', 'camelCase'],
      'vue/no-arrow-functions-in-watch': ['error'],
      'vue/html-closing-bracket-newline': [
        'error',
        {
          singleline: 'never',
          multiline: 'always',
        },
      ],
      'vue/custom-event-name-casing': ['warn', 'kebab-case'],
      'vue/mustache-interpolation-spacing': ['warn', 'always'],
      'vue/block-lang': [
        'error',
        {
          style: {
            lang: 'scss',
          },
        },
      ],
      'vue/require-name-property': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: ['./*.vue', '../*.vue'],
        },
      ],
      'vue/no-restricted-syntax': [
        'error',
        {
          selector:
            'VAttribute[directive=true] > VExpressionContainer CallExpression[arguments.length=0]',
          message: 'Используй `@click="method"` вместо `@click="method()"`.',
        },
      ],
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-param-reassign': ['error'],
      'unicorn/no-array-for-each': 'off',
      'unicorn/no-await-expression-member': 'off',
      'unicorn/no-object-as-default-parameter': 'off',
      'unicorn/switch-case-braces': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/prefer-module': 'off',
      'unicorn/filename-case': 'off',
      'unicorn/no-abusive-eslint-disable': 'off',
      'unicorn/prefer-regexp-test': 'off',
      'unicorn/no-useless-undefined': 'off',
      'unicorn/no-array-callback-reference': 'off',
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/prefer-ternary': 'off',
      'consistent-return': 'off',
      'vue/attribute-hyphenation': 'off',
      'no-multiple-empty-lines': [
        'error',
        {
          max: 1,
          maxEOF: 0,
        },
      ],
      'block-spacing': ['error', 'always'],
      'object-curly-spacing': ['error', 'always'],
      'arrow-body-style': ['error', 'as-needed'],
      'comma-spacing': ['error', { before: false, after: true }],
      'space-before-blocks': ['error', 'always'],
      'no-multi-spaces': ['error'],
      'key-spacing': [
        'error',
        {
          beforeColon: false,
          afterColon: true,
        },
      ],
      'space-infix-ops': ['error', { int32Hint: false }],
    },
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),
])
