// jest.config.js
// Comprehensive Jest configuration for security and penetration testing
// Compatible with react-scripts test runner

module.exports = {
  // Use jsdom for DOM testing (react-scripts provides this)
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

  // Transform files - use react-scripts preset for TypeScript
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': [
      'babel-jest',
      {
        presets: [
          ['react-app', { flow: false, typescript: true }],
        ],
      },
    ],
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
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 70,
      statements: 70,
    },
  },

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  // Test timeout (CI uses --testTimeout=15000 to override this)
  testTimeout: 15000,

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
  detectOpenHandles: false, // Disabled for react-scripts compatibility

  // Force exit after all tests complete
  forceExit: false, // Disabled for react-scripts compatibility

  // Clear mocks between tests
  clearMocks: true,

  // Reset mocks between tests
  resetMocks: true,

  // Restore mocks between tests
  restoreMocks: true,

  // NOTE: Multi-project configuration removed for react-scripts compatibility
  // react-scripts test does not support Jest's multi-project setup
  // Use --testPathPattern and --testPathIgnorePatterns flags instead
  //
  // Unit tests: npm run test:unit (--testPathIgnorePatterns=integration)
  // Integration tests: npm run test:integration (--testPathPattern=integration)
  // Security tests: npm run test:security (--testPathPattern=security)
};
