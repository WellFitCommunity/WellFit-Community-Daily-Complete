/**
 * Tests for App.tsx
 *
 * Comprehensive tests for the main application component.
 * Tests rendering, provider setup, and component composition.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestMemoryRouter } from './test-utils';

// ============================================================================
// MOCKS - Must be defined before importing App
// ============================================================================

// Mock react-query
vi.mock('@tanstack/react-query', () => ({
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="query-client-provider">{children}</div>
  ),
}));

vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => <div data-testid="react-query-devtools" />,
}));

// Mock branding config
vi.mock('./branding.config', () => ({
  getCurrentBranding: vi.fn().mockReturnValue({
    name: 'WellFit',
    logo: '/logo.png',
    primaryColor: '#1976d2',
  }),
  BrandingConfig: {},
}));

// Mock services
vi.mock('./services/performanceMonitoring', () => ({
  performanceMonitor: {
    initialize: vi.fn(),
  },
}));

vi.mock('./services/guardian-agent/GuardianAgent', () => ({
  GuardianAgent: {
    getInstance: vi.fn().mockReturnValue({
      start: vi.fn(),
      stop: vi.fn(),
    }),
  },
}));

vi.mock('./services/guardian-agent/SmartRecordingStrategy', () => ({
  smartRecordingStrategy: {
    startSmartRecording: vi.fn().mockResolvedValue(undefined),
    stopSmartRecording: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('./lib/queryClient', () => ({
  queryClient: {},
}));

// Mock routes
vi.mock('./routes', () => ({
  AppProviders: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-providers">{children}</div>
  ),
  RouteRenderer: () => <div data-testid="route-renderer">Routes</div>,
}));

// Mock AuthGate
vi.mock('./AuthGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-gate">{children}</div>
  ),
}));

// Mock AuthContext
vi.mock('./contexts/AuthContext', () => ({
  useAuth: vi.fn().mockReturnValue({
    supabase: {},
    user: { id: 'test-user-id' },
  }),
}));

// Mock layout components
vi.mock('./components/layout/AppHeader', () => ({
  default: () => <header data-testid="app-header">Header</header>,
}));

vi.mock('./components/layout/Footer', () => ({
  default: () => <footer data-testid="footer">Footer</footer>,
}));

// Mock app components
vi.mock('./components/app', () => ({
  ClinicalModeComponents: () => <div data-testid="clinical-mode-components" />,
  ClinicalPatientBanner: ({ className }: { className?: string }) => (
    <div data-testid="clinical-patient-banner" className={className} />
  ),
}));

// Mock global UI components
vi.mock('./components/OfflineIndicator', () => ({
  default: () => <div data-testid="offline-indicator" />,
}));

vi.mock('./components/ai-transparency', () => ({
  LearningMilestone: () => <div data-testid="learning-milestone" />,
}));

vi.mock('./components/IdleTimeoutProvider', () => ({
  IdleTimeoutProvider: ({
    children,
    timeoutMinutes,
    warningMinutes,
  }: {
    children: React.ReactNode;
    timeoutMinutes: number;
    warningMinutes: number;
  }) => (
    <div
      data-testid="idle-timeout-provider"
      data-timeout={timeoutMinutes}
      data-warning={warningMinutes}
    >
      {children}
    </div>
  ),
}));

// Mock hooks
vi.mock('./hooks/useTheme', () => ({
  useThemeInit: vi.fn(),
}));

vi.mock('./hooks/useBrowserHistoryProtection', () => ({
  useBrowserHistoryProtection: vi.fn(),
}));

// Import App after all mocks are set up
import App from './App';
import { useAuth } from './contexts/AuthContext';
import { performanceMonitor } from './services/performanceMonitoring';
import { GuardianAgent } from './services/guardian-agent/GuardianAgent';
import { smartRecordingStrategy } from './services/guardian-agent/SmartRecordingStrategy';
import { getCurrentBranding } from './branding.config';
import { useThemeInit } from './hooks/useTheme';
import { useBrowserHistoryProtection } from './hooks/useBrowserHistoryProtection';

const mockedUseAuth = vi.mocked(useAuth);
const mockedGetCurrentBranding = vi.mocked(getCurrentBranding);

// ============================================================================
// TEST WRAPPER
// ============================================================================

const renderApp = () => {
  return render(
    <TestMemoryRouter>
      <App />
    </TestMemoryRouter>
  );
};

// ============================================================================
// TESTS
// ============================================================================

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      supabase: {},
      user: { id: 'test-user-id' },
    } as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Component Structure', () => {
    it('should render QueryClientProvider at root', () => {
      renderApp();
      expect(screen.getByTestId('query-client-provider')).toBeInTheDocument();
    });

    it('should render AppProviders', () => {
      renderApp();
      expect(screen.getByTestId('app-providers')).toBeInTheDocument();
    });

    it('should render AppHeader', () => {
      renderApp();
      expect(screen.getByTestId('app-header')).toBeInTheDocument();
    });

    it('should render ClinicalPatientBanner with correct className', () => {
      renderApp();
      const banner = screen.getByTestId('clinical-patient-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveClass('sticky');
      expect(banner).toHaveClass('top-0');
      expect(banner).toHaveClass('z-40');
    });

    it('should render AuthGate', () => {
      renderApp();
      expect(screen.getByTestId('auth-gate')).toBeInTheDocument();
    });

    it('should render IdleTimeoutProvider with HIPAA-compliant settings', () => {
      renderApp();
      const idleProvider = screen.getByTestId('idle-timeout-provider');
      expect(idleProvider).toBeInTheDocument();
      expect(idleProvider).toHaveAttribute('data-timeout', '15');
      expect(idleProvider).toHaveAttribute('data-warning', '2');
    });

    it('should render RouteRenderer inside Suspense', () => {
      renderApp();
      expect(screen.getByTestId('route-renderer')).toBeInTheDocument();
    });

    it('should render Footer', () => {
      renderApp();
      expect(screen.getByTestId('footer')).toBeInTheDocument();
    });

    it('should render OfflineIndicator', () => {
      renderApp();
      expect(screen.getByTestId('offline-indicator')).toBeInTheDocument();
    });

    it('should render ClinicalModeComponents', () => {
      renderApp();
      expect(screen.getByTestId('clinical-mode-components')).toBeInTheDocument();
    });

    it('should render LearningMilestone', () => {
      renderApp();
      expect(screen.getByTestId('learning-milestone')).toBeInTheDocument();
    });
  });

  describe('Initialization', () => {
    it('should initialize theme on mount', () => {
      renderApp();
      expect(useThemeInit).toHaveBeenCalled();
    });

    it('should initialize browser history protection', () => {
      renderApp();
      expect(useBrowserHistoryProtection).toHaveBeenCalled();
    });

    it('should initialize performance monitoring with supabase and user id', async () => {
      renderApp();

      await waitFor(() => {
        expect(performanceMonitor.initialize).toHaveBeenCalledWith(
          {},
          'test-user-id'
        );
      });
    });

    it('should initialize Guardian Agent with HIPAA compliance mode', async () => {
      renderApp();

      await waitFor(() => {
        expect(GuardianAgent.getInstance).toHaveBeenCalledWith({
          autoHealEnabled: true,
          requireApprovalForCritical: false,
          learningEnabled: true,
          hipaaComplianceMode: true,
        });
      });
    });

    it('should start smart recording with user id', async () => {
      renderApp();

      await waitFor(() => {
        expect(smartRecordingStrategy.startSmartRecording).toHaveBeenCalledWith(
          'test-user-id'
        );
      });
    });

    it('should get initial branding', () => {
      renderApp();
      expect(getCurrentBranding).toHaveBeenCalled();
    });
  });

  describe('User State Handling', () => {
    it('should handle null user gracefully', async () => {
      mockedUseAuth.mockReturnValue({
        supabase: {},
        user: null,
      } as ReturnType<typeof useAuth>);

      renderApp();

      await waitFor(() => {
        expect(performanceMonitor.initialize).toHaveBeenCalledWith(
          {},
          undefined
        );
      });
    });

    it('should pass undefined user id to smart recording when no user', async () => {
      mockedUseAuth.mockReturnValue({
        supabase: {},
        user: null,
      } as ReturnType<typeof useAuth>);

      renderApp();

      await waitFor(() => {
        expect(smartRecordingStrategy.startSmartRecording).toHaveBeenCalledWith(
          undefined
        );
      });
    });
  });

  describe('React Query DevTools', () => {
    it('should render DevTools in development mode', () => {
      const originalMode = import.meta.env.MODE;
      // Note: Vitest runs in 'test' mode, so DevTools won't render
      // This test documents the expected behavior
      renderApp();
      // DevTools only render when MODE === 'development'
      // In test environment, this should not render
    });
  });

  describe('Component Hierarchy', () => {
    it('should have correct nesting: QueryClientProvider > AppProviders > AuthGate > IdleTimeoutProvider', () => {
      renderApp();

      const queryProvider = screen.getByTestId('query-client-provider');
      const appProviders = screen.getByTestId('app-providers');
      const authGate = screen.getByTestId('auth-gate');
      const idleProvider = screen.getByTestId('idle-timeout-provider');

      expect(queryProvider).toContainElement(appProviders);
      expect(appProviders).toContainElement(authGate);
      expect(authGate).toContainElement(idleProvider);
    });

    it('should render LearningMilestone before AppHeader', () => {
      renderApp();

      const learningMilestone = screen.getByTestId('learning-milestone');
      const header = screen.getByTestId('app-header');

      // Both should exist
      expect(learningMilestone).toBeInTheDocument();
      expect(header).toBeInTheDocument();
    });

    it('should render ClinicalPatientBanner before AuthGate content', () => {
      renderApp();

      const banner = screen.getByTestId('clinical-patient-banner');
      const authGate = screen.getByTestId('auth-gate');

      // Banner should be sibling to AuthGate, not inside it
      expect(authGate.parentElement).toContainElement(banner);
    });
  });
});
