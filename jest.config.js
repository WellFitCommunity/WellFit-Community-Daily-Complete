// jest.config.js
// Comprehensive Jest configuration for security and penetration testing

module.exports = {
  // Use jsdom for DOM testing
  testEnvironment: 'jsdom',

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],

  // Module paths
  roots: ['<rootDir>/src'],

  // Test match patterns
  testMatch: [
    '**/__tests__/**/*.{js,jsx,ts,tsx}',
    '**/*.{spec,test}.{js,jsx,ts,tsx}',
  ],

  // Transform files
  transform: {
    '^.+\\.(ts|tsx)$': 'babel-jest',
    '^.+\\.(js|jsx)$': 'babel-jest',
  },

  // Module name mapper for imports
  moduleNameMapper: {
    // Handle CSS imports (with CSS modules)
    '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',

    // Handle CSS imports (without CSS modules)
    '^.+\\.(css|sass|scss)$': '<rootDir>/__mocks__/styleMock.js',

    // Handle image imports
    '^.+\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',

    // MCP SDK mappings
    '^@modelcontextprotocol/sdk/client/index\\.js$':
      '<rootDir>/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js',
    '^@modelcontextprotocol/sdk/client/stdio\\.js$':
      '<rootDir>/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js',
  },

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.tsx',
    '!src/reportWebVitals.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**',
  ],

  // Coverage thresholds (enforce minimum coverage)
  coverageThresholds: {
    global: {
      branches: 60,
      functions: 60,
      lines: 70,
      statements: 70,
    },
  },

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  // Test timeout
  testTimeout: 30000,

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/build/',
    '/dist/',
    '/archive/',
    '/coverage/',
  ],

  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(@supabase|@testing-library|@modelcontextprotocol)/)',
  ],

  // Globals
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  },

  // Verbose output
  verbose: true,

  // Detect open handles (memory leaks)
  detectOpenHandles: true,

  // Force exit after all tests complete
  forceExit: true,

  // Clear mocks between tests
  clearMocks: true,

  // Reset mocks between tests
  resetMocks: true,

  // Restore mocks between tests
  restoreMocks: true,

  // Projects for different test types
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
      testPathIgnorePatterns: [
        '/node_modules/',
        '\\.integration\\.test\\.',
        '\\.security\\.test\\.',
      ],
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/src/**/*.integration.test.{ts,tsx}'],
      testTimeout: 60000,
    },
    {
      displayName: 'security',
      testMatch: ['<rootDir>/src/**/*.security.test.{ts,tsx}'],
      testTimeout: 60000,
      setupFilesAfterEnv: [
        '<rootDir>/src/setupTests.ts',
        '<rootDir>/src/setupSecurityTests.ts',
      ],
    },
  ],
};
