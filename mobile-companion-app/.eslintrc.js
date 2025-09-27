module.exports = {
  extends: [
    'expo',
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  env: {
    browser: true,
    es2021: true,
    node: true,
    'react-native/react-native': true
  },
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
    // React specific rules
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // General code quality
    'no-unused-vars': 'warn',
    'no-console': 'off', // Allow console for debugging in mobile app
    'prefer-const': 'error',
    'no-var': 'error',

    // TypeScript specific
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',

    // Security and health monitoring specific
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error'
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    '.expo/',
    'android/',
    'ios/'
  ]
};