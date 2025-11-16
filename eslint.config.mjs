// eslint.config.js
// Modern ESLint Flat Config (ESLint 9+)
// Replaces deprecated .eslintrc.json format

import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import securityPlugin from 'eslint-plugin-security';

export default [
  // Base JavaScript recommended rules
  js.configs.recommended,

  // Global ignores
  {
    ignores: [
      'node_modules/**',
      'build/**',
      'dist/**',
      'coverage/**',
      'archive/**',
      'supabase/functions/**', // Deno functions have separate config
      'mobile-companion-app/**', // Has its own config
      'scripts/**', // Node scripts
      'setupTests.js',
    ],
  },

  // Main configuration for all JavaScript/TypeScript files
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],

    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      '@typescript-eslint': typescriptPlugin,
      security: securityPlugin,
    },

    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.es2020,
        ...globals.node,
      },
    },

    settings: {
      react: {
        version: 'detect',
      },
    },

    rules: {
      // React rules
      'react/react-in-jsx-scope': 'off', // Not needed with React 17+
      'react/prop-types': 'off', // Using TypeScript for prop validation
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',

      // React Hooks rules
      // TEMPORARY: Disabled due to ESLint 9 incompatibility with react-hooks v4
      // TODO: Re-enable when react-hooks supports ESLint 9 flat config
      // 'react-hooks/rules-of-hooks': 'error',
      // 'react-hooks/exhaustive-deps': 'warn',

      // General code quality
      'no-console': 'warn', // HIPAA compliance - use auditLogger instead
      'no-debugger': 'error',
      'no-unused-vars': 'off', // Handled by TypeScript
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // Security rules (OWASP compliance)
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-unsafe-regex': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-non-literal-require': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'error',

      // Best practices
      'no-var': 'error',
      'prefer-const': 'warn',
      'prefer-arrow-callback': 'warn',
      'no-throw-literal': 'error',
      'no-return-await': 'error',
      'require-await': 'warn',

      // TypeScript specific
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
    },
  },

  // Test files configuration
  {
    files: ['src/**/*.test.{js,jsx,ts,tsx}', 'src/**/__tests__/**/*.{js,jsx,ts,tsx}'],

    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.browser,
      },
    },

    rules: {
      // Relax some rules for tests
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-fs-filename': 'off',
    },
  },

  // Security test files - even more relaxed
  {
    files: ['src/**/*.security.test.{js,jsx,ts,tsx}'],

    rules: {
      // Allow security testing patterns
      'security/detect-eval-with-expression': 'off',
      'security/detect-non-literal-regexp': 'off',
      'security/detect-unsafe-regex': 'off',
      'no-eval': 'off', // Needed for testing eval vulnerabilities
    },
  },

  // CommonJS config files
  {
    files: [
      '*.config.js',
      '*.config.mjs',
      '**/.eslintrc.js',
      '.eslintrc.*.js',
      'eslint-plugin-*.js',
      '__mocks__/**/*.js',
      'mocks/**/*.js',
      'functions/**/*.js',
    ],

    languageOptions: {
      globals: {
        ...globals.node,
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },

    rules: {
      'no-console': 'off',
    },
  },

  // K6 load test files
  {
    files: ['load-tests/**/*.js'],

    languageOptions: {
      globals: {
        ...globals.node,
        __ENV: 'readonly',
        __VU: 'readonly',
        __ITER: 'readonly',
        console: 'readonly',
        open: 'readonly',
      },
    },

    rules: {
      'no-console': 'off',
      'no-unused-vars': 'warn',
    },
  },

  // Root-level test files
  {
    files: ['test-*.js', '*.test.js'],

    languageOptions: {
      globals: {
        ...globals.node,
        console: 'readonly',
      },
    },

    rules: {
      'no-console': 'off',
      'no-unused-vars': 'warn',
    },
  },

  // Service worker files
  {
    files: ['public/**/*-sw.js', 'public/service-worker.js'],

    languageOptions: {
      globals: {
        ...globals.serviceworker,
        importScripts: 'readonly',
        firebase: 'readonly',
        messaging: 'readonly',
      },
    },

    rules: {
      'no-console': 'off',
      'no-empty': 'warn',
      'no-unused-vars': 'warn',
    },
  },
];
