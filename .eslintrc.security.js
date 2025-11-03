module.exports = {
  extends: ['plugin:security/recommended-legacy'],
  plugins: ['security'],
  env: {
    node: true,
    es6: true,
    browser: true
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  rules: {
    // Security-focused rules (augmenting the recommended preset)
    // Downgrade object-injection to warn - too many false positives with safe bracket notation
    'security/detect-object-injection': 'warn',
    'security/detect-eval-with-expression': 'error',
    'security/detect-non-literal-regexp': 'warn',
    'security/detect-non-literal-require': 'error',
    'security/detect-possible-timing-attacks': 'warn',
    'security/detect-pseudoRandomBytes': 'error',
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'warn',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-new-buffer': 'error',
    'security/detect-no-csrf-before-method-override': 'error',

    // Additional security patterns
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',

    // Informational only - suppress non-security TypeScript style issues
    'no-console': 'off', // Already handled by HIPAA pre-commit hook
    '@typescript-eslint/no-explicit-any': 'off', // Will address systematically
    '@typescript-eslint/no-non-null-assertion': 'warn', // Real issue but low priority
    '@typescript-eslint/no-inferrable-types': 'off', // Style issue, not security
    '@typescript-eslint/no-empty-function': 'off', // Style issue, not security
    '@typescript-eslint/ban-ts-comment': 'warn', // Should review but not block
    '@typescript-eslint/no-unused-vars': 'warn' // Code quality, not security
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint', 'security'],
      extends: [
        'plugin:@typescript-eslint/recommended',
        'plugin:security/recommended-legacy'
      ],
      rules: {
        // TypeScript-specific overrides for security scan
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'warn',
        '@typescript-eslint/no-inferrable-types': 'off',
        '@typescript-eslint/no-empty-function': 'off',
        '@typescript-eslint/ban-ts-comment': 'warn',
        '@typescript-eslint/no-unused-vars': ['warn', {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }]
      }
    },
    {
      // Test files - more lenient
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', '**/test/**', '**/__tests__/**'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'security/detect-object-injection': 'off'
      }
    }
  ]
};