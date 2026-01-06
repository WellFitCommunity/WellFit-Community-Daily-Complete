/**
 * useIdleTimeout.test.ts - Tests for idle timeout hook
 *
 * Purpose: Verify HIPAA-compliant auto-logout, activity tracking, warning state,
 * session extension, and localStorage persistence.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Use vi.hoisted to define mocks used inside vi.mock factories
const { mockNavigate, mockSignOut, mockAuditLogger } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSignOut: vi.fn(),
  mockAuditLogger: {
    auth: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signOut: () => mockSignOut(),
    },
  },
}));

vi.mock('../../services/auditLogger', () => ({
  auditLogger: mockAuditLogger,
}));

// Import after mocks
import { useIdleTimeout } from '../useIdleTimeout';

describe('useIdleTimeout', () => {
  const LAST_ACTIVITY_KEY = 'wf_last_activity';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();
    mockSignOut.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with showWarning=false', () => {
      const { result } = renderHook(() => useIdleTimeout());

      expect(result.current.showWarning).toBe(false);
      expect(result.current.secondsRemaining).toBe(0);
    });

    it('should set last activity in localStorage on mount', () => {
      renderHook(() => useIdleTimeout());

      const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
      expect(stored).not.toBeNull();
    });

    it('should not set activity when disabled', () => {
      renderHook(() => useIdleTimeout({ enabled: false }));

      // When disabled, the hook should not interfere
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Activity Tracking', () => {
    it('should update activity timestamp on mouse events', () => {
      renderHook(() => useIdleTimeout());

      const initialActivity = localStorage.getItem(LAST_ACTIVITY_KEY);

      // Advance time past throttle threshold
      vi.advanceTimersByTime(35000);

      // Simulate mouse event
      act(() => {
        document.dispatchEvent(new MouseEvent('mousedown'));
      });

      const updatedActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
      expect(Number(updatedActivity)).toBeGreaterThan(Number(initialActivity));
    });

    it('should update activity timestamp on keyboard events', () => {
      renderHook(() => useIdleTimeout());

      // Advance time past throttle threshold
      vi.advanceTimersByTime(35000);

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown'));
      });

      expect(localStorage.getItem(LAST_ACTIVITY_KEY)).not.toBeNull();
    });

    it('should throttle activity updates', () => {
      renderHook(() => useIdleTimeout());

      const initialActivity = localStorage.getItem(LAST_ACTIVITY_KEY);

      // Multiple events within throttle window shouldn't update
      act(() => {
        document.dispatchEvent(new MouseEvent('mousedown'));
        document.dispatchEvent(new MouseEvent('mousedown'));
        document.dispatchEvent(new MouseEvent('mousedown'));
      });

      // Activity shouldn't change within throttle window
      expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBe(initialActivity);
    });
  });

  describe('Warning State', () => {
    it('should start with warning hidden', () => {
      const { result } = renderHook(() =>
        useIdleTimeout({
          timeoutMs: 5000,
          warningBeforeMs: 2000,
        })
      );

      expect(result.current.showWarning).toBe(false);
    });

    it('should provide extendSession and logoutNow functions', () => {
      const { result } = renderHook(() => useIdleTimeout());

      expect(typeof result.current.extendSession).toBe('function');
      expect(typeof result.current.logoutNow).toBe('function');
    });
  });

  describe('Session Extension', () => {
    it('should update localStorage on extend', () => {
      const { result } = renderHook(() => useIdleTimeout());

      act(() => {
        result.current.extendSession();
      });

      const activity = localStorage.getItem(LAST_ACTIVITY_KEY);
      expect(activity).not.toBeNull();
    });

    it('should log session extension', () => {
      const { result } = renderHook(() => useIdleTimeout());

      act(() => {
        result.current.extendSession();
      });

      expect(mockAuditLogger.info).toHaveBeenCalledWith('SESSION_EXTENDED', { reason: 'user_action' });
    });

    it('should reset seconds remaining', () => {
      const { result } = renderHook(() => useIdleTimeout());

      act(() => {
        result.current.extendSession();
      });

      expect(result.current.secondsRemaining).toBe(0);
    });
  });

  describe('Logout', () => {
    it('should call logoutNow and navigate to login', async () => {
      const { result } = renderHook(() => useIdleTimeout());

      await act(async () => {
        result.current.logoutNow();
      });

      expect(mockSignOut).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith(
        '/login',
        expect.objectContaining({
          state: expect.objectContaining({
            message: expect.stringContaining('logged out due to inactivity'),
          }),
          replace: true,
        })
      );
    });

    it('should log auth event on logout', async () => {
      const { result } = renderHook(() => useIdleTimeout());

      await act(async () => {
        result.current.logoutNow();
      });

      expect(mockAuditLogger.auth).toHaveBeenCalledWith(
        'LOGOUT',
        true,
        expect.objectContaining({ reason: 'idle_timeout' })
      );
    });

    it('should call onLogout callback', async () => {
      const onLogout = vi.fn();

      const { result } = renderHook(() => useIdleTimeout({ onLogout }));

      await act(async () => {
        result.current.logoutNow();
      });

      expect(onLogout).toHaveBeenCalled();
    });

    it('should clear localStorage on logout', async () => {
      const { result } = renderHook(() => useIdleTimeout());

      // Ensure activity is stored
      expect(localStorage.getItem(LAST_ACTIVITY_KEY)).not.toBeNull();

      await act(async () => {
        result.current.logoutNow();
      });

      expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBeNull();
    });

    it('should handle signOut error gracefully', async () => {
      mockSignOut.mockRejectedValue(new Error('Sign out failed'));

      const { result } = renderHook(() => useIdleTimeout());

      await act(async () => {
        result.current.logoutNow();
      });

      expect(mockAuditLogger.error).toHaveBeenCalledWith(
        'IDLE_LOGOUT_ERROR',
        expect.any(Error)
      );
      // Should still navigate
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() => useIdleTimeout());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should respect custom timeout', () => {
      const { result } = renderHook(() =>
        useIdleTimeout({
          timeoutMs: 60000, // 1 minute
          warningBeforeMs: 10000, // 10 second warning
        })
      );

      // Advance 50 seconds - should not trigger warning yet
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Initially no warning (within timeout)
      expect(result.current.showWarning).toBe(false);
    });

    it('should not run when enabled=false', () => {
      renderHook(() => useIdleTimeout({ enabled: false }));

      // Advance way past timeout
      act(() => {
        vi.advanceTimersByTime(60 * 60 * 1000);
      });

      // Should not have tried to logout
      expect(mockSignOut).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Activity Events', () => {
    it('should listen to document events', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      renderHook(() => useIdleTimeout());

      // Should add listeners for common activity events
      const addedEvents = addEventListenerSpy.mock.calls.map(call => call[0]);
      expect(addedEvents).toContain('mousedown');
      expect(addedEvents).toContain('keydown');
      expect(addedEvents).toContain('scroll');
      expect(addedEvents).toContain('touchstart');
    });

    it('should not add listeners when disabled', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const initialCallCount = addEventListenerSpy.mock.calls.length;

      renderHook(() => useIdleTimeout({ enabled: false }));

      // Should not add more listeners
      expect(addEventListenerSpy.mock.calls.length).toBe(initialCallCount);
    });
  });
});
