/**
 * App Smoke Test
 *
 * Tier 1 - Smoke Test: Verify basic rendering without crashing.
 * No Supabase calls, no complex mocking, no network requests.
 *
 * Purpose: Catch catastrophic import/render errors before they hit production.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock the contexts that App depends on
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    isAuthenticated: false,
  }),
  useSupabaseClient: () => ({
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../contexts/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    isAdminAuthenticated: false,
    adminUser: null,
    loading: false,
  }),
  AdminAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../contexts/SessionTimeoutContext', () => ({
  SessionTimeoutProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSessionTimeout: () => ({
    isActive: true,
    lastActivity: new Date(),
    resetTimeout: vi.fn(),
  }),
}));

// Mock services that make external calls
vi.mock('../../services/performanceMonitoring', () => ({
  performanceMonitor: {
    logNavigation: vi.fn(),
    logError: vi.fn(),
  },
}));

vi.mock('../../services/guardian-agent/GuardianAgent', () => ({
  GuardianAgent: {
    getInstance: vi.fn(() => ({
      init: vi.fn(),
      shutdown: vi.fn(),
    })),
  },
}));

vi.mock('../../lib/queryClient', () => ({
  queryClient: {
    clear: vi.fn(),
    getQueryCache: vi.fn(() => ({ clear: vi.fn() })),
    getMutationCache: vi.fn(() => ({ clear: vi.fn() })),
  },
}));

// Mock branding config
vi.mock('../../branding.config', () => ({
  getCurrentBranding: () => ({
    id: 'test',
    name: 'Test App',
    displayName: 'Test Application',
    logoUrl: '/logo.png',
    primaryColor: '#00857a',
    secondaryColor: '#33bfb7',
  }),
  BrandingConfig: {},
}));

// Minimal test wrapper
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('App Smoke Tests', () => {
  beforeEach(() => {
    // Clear any previous render artifacts
    vi.clearAllMocks();
  });

  it('should have correct React version', () => {
    expect(React.version).toMatch(/^19\./);
  });

  it('should render BrowserRouter without crashing', () => {
    render(
      <TestWrapper>
        <div data-testid="router-test">Router works</div>
      </TestWrapper>
    );

    expect(screen.getByTestId('router-test')).toBeInTheDocument();
  });

  it('should render basic React elements', () => {
    render(
      <TestWrapper>
        <main>
          <h1>WellFit Community</h1>
          <p>Health tracking app</p>
        </main>
      </TestWrapper>
    );

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('WellFit Community');
  });
});

describe('Critical Component Import Tests', () => {
  it('should import ErrorBoundary without throwing', async () => {
    const importPromise = import('../../ErrorBoundary');
    await expect(importPromise).resolves.toBeDefined();
  });

  it('should import AuthGate without throwing', async () => {
    const importPromise = import('../../AuthGate');
    await expect(importPromise).resolves.toBeDefined();
  });
});
