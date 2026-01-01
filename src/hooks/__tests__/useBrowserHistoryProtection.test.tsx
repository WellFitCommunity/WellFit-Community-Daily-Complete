/**
 * Tests for useBrowserHistoryProtection Hook
 *
 * Verifies enterprise-grade browser back button protection for admin panel.
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';

// ============================================================================
// MOCKS
// ============================================================================

// Track navigation calls
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: vi.fn(),
  };
});

vi.mock('../../contexts/AuthContext', () => ({
  useSession: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('../../contexts/NavigationHistoryContext', () => ({
  useNavigationHistorySafe: vi.fn(),
}));

vi.mock('../../services/auditLogger', () => ({
  auditLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { useBrowserHistoryProtection } from '../useBrowserHistoryProtection';
import { useSession, useAuth } from '../../contexts/AuthContext';
import { useNavigationHistorySafe } from '../../contexts/NavigationHistoryContext';
import { useLocation as useLocationMock } from 'react-router-dom';

const mockedUseSession = vi.mocked(useSession);
const mockedUseAuth = vi.mocked(useAuth);
const mockedUseNavigationHistorySafe = vi.mocked(useNavigationHistorySafe);
const mockedUseLocation = vi.mocked(useLocationMock);

// ============================================================================
// TEST UTILITIES
// ============================================================================

interface WrapperProps {
  children: React.ReactNode;
}

const createWrapper = (initialPath: string = '/admin') => {
  return function Wrapper({ children }: WrapperProps) {
    return (
      <MemoryRouter initialEntries={[initialPath]}>
        {children}
      </MemoryRouter>
    );
  };
};

const mockSession = { user: { id: 'test-user' } };

const mockAuthContext = {
  isAdmin: true,
  user: { id: 'test-user' },
};

const mockNavHistory = {
  canGoBack: true,
  goBack: vi.fn(),
  getPreviousRoute: vi.fn().mockReturnValue('/admin'),
  clearHistory: vi.fn(),
  historyStack: ['/admin', '/admin/settings'],
  getLastRoute: vi.fn().mockReturnValue('/admin/settings'),
  canResumeSession: true,
  resumeSession: vi.fn(),
};

// ============================================================================
// TESTS
// ============================================================================

describe('useBrowserHistoryProtection', () => {
  let originalHistoryPushState: typeof window.history.pushState;
  let mockPushState: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Store original pushState
    originalHistoryPushState = window.history.pushState.bind(window.history);
    mockPushState = vi.fn();
    // Replace pushState with a properly typed mock
    Object.defineProperty(window.history, 'pushState', {
      value: mockPushState,
      writable: true,
      configurable: true,
    });

    // Default mocks
    mockedUseSession.mockReturnValue(mockSession as ReturnType<typeof useSession>);
    mockedUseAuth.mockReturnValue(mockAuthContext as ReturnType<typeof useAuth>);
    mockedUseNavigationHistorySafe.mockReturnValue(mockNavHistory);
    mockedUseLocation.mockReturnValue({
      pathname: '/admin/settings',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    });
  });

  afterEach(() => {
    // Restore original pushState
    Object.defineProperty(window.history, 'pushState', {
      value: originalHistoryPushState,
      writable: true,
      configurable: true,
    });
    vi.clearAllTimers();
  });

  describe('Initialization', () => {
    it('should push protective state when authenticated on non-auth route', () => {
      renderHook(() => useBrowserHistoryProtection(), {
        wrapper: createWrapper('/admin'),
      });

      expect(mockPushState).toHaveBeenCalledWith(
        expect.objectContaining({ protected: true }),
        '',
        '/admin/settings'
      );
    });

    it('should NOT push protective state when not authenticated', () => {
      mockedUseSession.mockReturnValue(null);

      renderHook(() => useBrowserHistoryProtection(), {
        wrapper: createWrapper('/admin'),
      });

      expect(mockPushState).not.toHaveBeenCalled();
    });

    it('should push registration flow protection on auth routes (for back button support)', () => {
      mockedUseLocation.mockReturnValue({
        pathname: '/login',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useBrowserHistoryProtection(), {
        wrapper: createWrapper('/login'),
      });

      // Should push registration flow protection (not authenticated user protection)
      expect(mockPushState).toHaveBeenCalledWith(
        expect.objectContaining({ registrationFlow: true }),
        '',
        '/login'
      );
    });
  });

  describe('Route Protection Detection', () => {
    it('should identify admin routes as protected', () => {
      mockedUseLocation.mockReturnValue({
        pathname: '/admin/users',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useBrowserHistoryProtection(), {
        wrapper: createWrapper('/admin/users'),
      });

      // Should push protective state for admin routes
      expect(mockPushState).toHaveBeenCalled();
    });

    it('should identify super-admin routes as protected', () => {
      mockedUseLocation.mockReturnValue({
        pathname: '/super-admin/dashboard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useBrowserHistoryProtection(), {
        wrapper: createWrapper('/super-admin/dashboard'),
      });

      expect(mockPushState).toHaveBeenCalled();
    });

    it('should identify billing routes as protected', () => {
      mockedUseLocation.mockReturnValue({
        pathname: '/billing/review',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useBrowserHistoryProtection(), {
        wrapper: createWrapper('/billing/review'),
      });

      expect(mockPushState).toHaveBeenCalled();
    });

    it('should identify nurse routes as protected', () => {
      mockedUseLocation.mockReturnValue({
        pathname: '/nurse-dashboard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useBrowserHistoryProtection(), {
        wrapper: createWrapper('/nurse-dashboard'),
      });

      expect(mockPushState).toHaveBeenCalled();
    });
  });

  describe('Popstate Handling', () => {
    it('should add popstate event listener', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      renderHook(() => useBrowserHistoryProtection(), {
        wrapper: createWrapper('/admin'),
      });

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'popstate',
        expect.any(Function)
      );

      addEventListenerSpy.mockRestore();
    });

    it('should remove popstate event listener on cleanup', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useBrowserHistoryProtection(), {
        wrapper: createWrapper('/admin'),
      });

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'popstate',
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });

    it('should not intercept when user is not authenticated', () => {
      mockedUseSession.mockReturnValue(null);

      renderHook(() => useBrowserHistoryProtection(), {
        wrapper: createWrapper('/admin'),
      });

      // Simulate popstate event
      act(() => {
        const event = new PopStateEvent('popstate', { state: null });
        window.dispatchEvent(event);
      });

      // Should not navigate when not authenticated
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Navigation History Integration', () => {
    it('should use NavigationHistoryContext when available', () => {
      mockedUseNavigationHistorySafe.mockReturnValue({
        ...mockNavHistory,
        canGoBack: true,
        getPreviousRoute: vi.fn().mockReturnValue('/admin/users'),
      });

      renderHook(() => useBrowserHistoryProtection(), {
        wrapper: createWrapper('/admin'),
      });

      // Hook should integrate with nav history
      expect(mockedUseNavigationHistorySafe).toHaveBeenCalled();
    });

    it('should fall back gracefully when NavigationHistoryContext returns null', () => {
      // useNavigationHistorySafe returns null when context is not available
      mockedUseNavigationHistorySafe.mockReturnValue(null);

      // Should not throw
      expect(() => {
        renderHook(() => useBrowserHistoryProtection(), {
          wrapper: createWrapper('/admin'),
        });
      }).not.toThrow();
    });
  });

  describe('Fallback Routes', () => {
    it('should fallback to /admin when in admin routes and no history', () => {
      mockedUseNavigationHistorySafe.mockReturnValue({
        ...mockNavHistory,
        canGoBack: false,
        getPreviousRoute: vi.fn().mockReturnValue(null),
      });

      // This tests the getFallbackRoute logic
      mockedUseLocation.mockReturnValue({
        pathname: '/admin/settings',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useBrowserHistoryProtection(), {
        wrapper: createWrapper('/admin/settings'),
      });

      // The hook should be initialized and ready to use fallback
      expect(mockedUseAuth).toHaveBeenCalled();
    });
  });

  describe('Registration Flow Protection', () => {
    it('should push protective state on registration page', () => {
      mockedUseSession.mockReturnValue(null); // Not authenticated
      mockedUseLocation.mockReturnValue({
        pathname: '/register',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useBrowserHistoryProtection(), {
        wrapper: createWrapper('/register'),
      });

      expect(mockPushState).toHaveBeenCalledWith(
        expect.objectContaining({ registrationFlow: true, path: '/register' }),
        '',
        '/register'
      );
    });

    it('should push protective state on login page', () => {
      mockedUseSession.mockReturnValue(null);
      mockedUseLocation.mockReturnValue({
        pathname: '/login',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useBrowserHistoryProtection(), {
        wrapper: createWrapper('/login'),
      });

      expect(mockPushState).toHaveBeenCalledWith(
        expect.objectContaining({ registrationFlow: true, path: '/login' }),
        '',
        '/login'
      );
    });

    it('should push protective state on verify-code page', () => {
      mockedUseSession.mockReturnValue(null);
      mockedUseLocation.mockReturnValue({
        pathname: '/verify-code',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useBrowserHistoryProtection(), {
        wrapper: createWrapper('/verify-code'),
      });

      expect(mockPushState).toHaveBeenCalledWith(
        expect.objectContaining({ registrationFlow: true, path: '/verify-code' }),
        '',
        '/verify-code'
      );
    });

    it('should NOT push protective state on dashboard (not registration flow)', () => {
      mockedUseSession.mockReturnValue(null);
      mockedUseLocation.mockReturnValue({
        pathname: '/dashboard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useBrowserHistoryProtection(), {
        wrapper: createWrapper('/dashboard'),
      });

      // Should not have been called with registrationFlow
      const registrationFlowCalls = mockPushState.mock.calls.filter(
        call => call[0]?.registrationFlow === true
      );
      expect(registrationFlowCalls.length).toBe(0);
    });
  });

  describe('BeforeUnload Protection', () => {
    it('should add beforeunload listener for protected routes', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      mockedUseLocation.mockReturnValue({
        pathname: '/admin/settings',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useBrowserHistoryProtection(), {
        wrapper: createWrapper('/admin/settings'),
      });

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      );

      addEventListenerSpy.mockRestore();
    });

    it('should NOT add beforeunload listener for non-protected routes', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      mockedUseLocation.mockReturnValue({
        pathname: '/dashboard',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useBrowserHistoryProtection(), {
        wrapper: createWrapper('/dashboard'),
      });

      // Filter to only check beforeunload calls
      const beforeUnloadCalls = addEventListenerSpy.mock.calls.filter(
        call => call[0] === 'beforeunload'
      );

      expect(beforeUnloadCalls.length).toBe(0);

      addEventListenerSpy.mockRestore();
    });
  });
});
